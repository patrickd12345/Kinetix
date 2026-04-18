git_clone() {
  local repo_name="$1"
  local dest="$2"
  local success=0

  echo "Cloning patrickd12345/${repo_name}..."

  if [ -n "${BOOKIJI_INC_CLONE_TOKEN:-}" ]; then
    if env GIT_TERMINAL_PROMPT=0 git -c http.extraheader="" clone --depth 1 "https://x-access-token:${BOOKIJI_INC_CLONE_TOKEN}@github.com/patrickd12345/${repo_name}.git" "$dest"; then
      success=1
    fi
  fi

  if [ "$success" -eq 0 ] && [ -n "${GITHUB_TOKEN:-}" ]; then
    if env GIT_TERMINAL_PROMPT=0 git -c http.extraheader="" clone --depth 1 "https://x-access-token:${GITHUB_TOKEN}@github.com/patrickd12345/${repo_name}.git" "$dest"; then
      success=1
    fi
  fi

  if [ "$success" -eq 0 ]; then
    echo "Error: Failed to clone ${repo_name} with all available tokens."
    return 1
  fi
}
