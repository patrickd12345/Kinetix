import re

with open('apps/web/src/hooks/useKinetixCoachingContext.test.ts', 'r') as f:
    content = f.read()

# Fix the test
search = """    expect(__testables.buildNullData()).toEqual({
      coach: null,
      prediction: null,
      loadControl: null,
      goalProgress: null,
    })"""
replace = """    expect(__testables.buildNullData()).toEqual({
      coach: null,
      prediction: null,
      loadControl: null,
      goalProgress: null,
      plannedRaceContext: null,
    })"""

content = content.replace(search, replace)

with open('apps/web/src/hooks/useKinetixCoachingContext.test.ts', 'w') as f:
    f.write(content)

print("Patched useKinetixCoachingContext.test.ts")
