import XCTest
@testable import KinetixPhone

/// KX-FEAT-008 / 009: Coach chat provider selection, Foundation Models wiring (production), fallback, sanitization (XCTest / KinetixPhoneTests).
final class CoachChatProviderTests: XCTestCase {

    override func tearDown() {
        super.tearDown()
        #if DEBUG && os(iOS)
        SharedAIExecutionService._unitTestCoachChatProvider = nil
        #endif
    }

    func testEmptyProviderResponseUsesFallback() async throws {
        #if DEBUG && os(iOS)
        let mock = MockKinetixAppleIntelligenceService(
            chatResult: (text: "   ", usedFallback: false)
        )
        SharedAIExecutionService._unitTestCoachChatProvider = mock
        let service = SharedAIExecutionService()
        let metrics = FormMetrics()
        let text = try await service.ask(question: "Hi", metrics: metrics)
        XCTAssertEqual(text, SharedAIExecutionService.coachChatUnavailableUserMessage)
        #else
        throw XCTSkip("Coach chat provider injection tests run on iOS Simulator/device only.")
        #endif
    }

    func testProviderSignalsFallbackUsesControlledMessage() async throws {
        #if DEBUG && os(iOS)
        let mock = MockKinetixAppleIntelligenceService(
            chatResult: (text: "should be ignored", usedFallback: true)
        )
        SharedAIExecutionService._unitTestCoachChatProvider = mock
        let service = SharedAIExecutionService()
        let metrics = FormMetrics()
        let text = try await service.ask(question: "Hi", metrics: metrics)
        XCTAssertEqual(text, SharedAIExecutionService.coachChatUnavailableUserMessage)
        #else
        throw XCTSkip("Coach chat provider injection tests run on iOS Simulator/device only.")
        #endif
    }

    func testNormalProviderResponsePassesThrough() async throws {
        #if DEBUG && os(iOS)
        let expected = "Keep a steady cadence and relax your shoulders."
        let mock = MockKinetixAppleIntelligenceService(
            chatResult: (text: expected, usedFallback: false)
        )
        SharedAIExecutionService._unitTestCoachChatProvider = mock
        let service = SharedAIExecutionService()
        var metrics = FormMetrics()
        metrics.cadence = 170
        metrics.verticalOscillation = 8
        metrics.groundContactTime = 240
        metrics.heartRate = 150
        metrics.pace = 300
        metrics.distance = 2000
        let text = try await service.ask(question: "Tips?", metrics: metrics)
        XCTAssertEqual(text, expected)
        #else
        throw XCTSkip("Coach chat provider injection tests run on iOS Simulator/device only.")
        #endif
    }

    func testSanitizerStripsGeminiAndApiKeyWording() {
        XCTAssertEqual(
            CoachChatSanitizer.sanitizeUserFacing("Add a Gemini API key in settings."),
            SharedAIExecutionService.coachChatUnavailableUserMessage
        )
        XCTAssertEqual(
            CoachChatSanitizer.sanitizeUserFacing("Please set your api key"),
            SharedAIExecutionService.coachChatUnavailableUserMessage
        )
        XCTAssertEqual(
            CoachChatSanitizer.sanitizeUserFacing("Nice work on that interval."),
            "Nice work on that interval."
        )
    }

    /// KX-FEAT-009: User-facing fallback must never suggest third-party AI setup (stable copy for Simulator + device).
    func testControlledFallbackExcludesThirdPartySetupKeywords() {
        let fb = SharedAIExecutionService.coachChatUnavailableUserMessage
        XCTAssertFalse(fb.localizedCaseInsensitiveContains("gemini"))
        XCTAssertFalse(fb.localizedCaseInsensitiveContains("api key"))
        XCTAssertFalse(fb.localizedCaseInsensitiveContains("google"))
    }

    /// When the real `DefaultKinetixAppleIntelligenceService` path is used (no mock), orchestration still yields the controlled string if the provider returns fallback — no Gemini leakage in that string.
    func testAskUsesControlledMessageWhenMockReturnsFallbackSignal() async throws {
        #if DEBUG && os(iOS)
        let mock = MockKinetixAppleIntelligenceService(chatResult: ("", true))
        SharedAIExecutionService._unitTestCoachChatProvider = mock
        let service = SharedAIExecutionService()
        let text = try await service.ask(question: "Hi", metrics: FormMetrics())
        XCTAssertEqual(text, SharedAIExecutionService.coachChatUnavailableUserMessage)
        XCTAssertFalse(text.localizedCaseInsensitiveContains("gemini"))
        #else
        throw XCTSkip("Coach chat provider injection tests run on iOS Simulator/device only.")
        #endif
    }
}

#if DEBUG && os(iOS)
/// Minimal test double for `KinetixAppleIntelligenceService` (coach chat path only needs `generateChatResponse`).
private final class MockKinetixAppleIntelligenceService: KinetixAppleIntelligenceService {
    let chatResult: (text: String, usedFallback: Bool)

    init(chatResult: (text: String, usedFallback: Bool)) {
        self.chatResult = chatResult
    }

    func isAppleIntelligenceAvailable() -> KinetixAppleIntelligenceAvailability { .available }

    func generateChatResponse(question: String, metrics: FormMetrics) async -> (text: String, usedFallback: Bool) {
        _ = question
        _ = metrics
        return chatResult
    }

    func generateReadinessExplanation(_ input: ReadinessExplanationInput) async -> ReadinessExplanationResult {
        ReadinessExplanationResult(text: "", usedFallback: true)
    }

    func generatePostRunSummary(_ input: PostRunSummaryInput) async -> PostRunSummaryResult {
        PostRunSummaryResult(text: "", usedFallback: true)
    }

    func generatePreRunSuggestion(_ input: PreRunSuggestionInput) async -> PreRunSuggestionResult {
        PreRunSuggestionResult(text: "", usedFallback: true)
    }

    func generateRecoveryAlert(_ input: RecoveryAlertInput) async -> RecoveryAlertResult {
        RecoveryAlertResult(text: "", usedFallback: true)
    }
}
#endif
