import Foundation
import SwiftUI

public class FormCoach: ObservableObject {
    
    // MARK: - Published Properties
    
    @Published public var isFormValid: Bool = true
    @Published public var currentStep: Int = 0
    @Published public var errorMessage: String? = nil
    
    // MARK: - Initializer
    
    public init() { }
    
    // MARK: - Methods
    
    public func validateCurrentStep() -> Bool {
        // Stub method for validating the current step
        return true
    }
    
    public func goToNextStep() {
        // Stub method to move to the next step
        currentStep += 1
    }
    
    public func resetForm() {
        // Stub method to reset the form state
        currentStep = 0
        errorMessage = nil
        isFormValid = true
    }
}
