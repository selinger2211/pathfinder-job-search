# Skill Patch: Settings Live-Update Pattern

**Add this to `build-with-ili/SKILL.md` after the "Code Quality Standards" section and before "Part 5: Context Management".**

To apply: Open `~/.claude/skills/build-with-ili/SKILL.md` (or wherever the skill is installed) and paste the following section.

---

### Settings Live-Update Pattern (Mandatory)

**Every setting that changes state must update the UI immediately. No exceptions.** Users should never need to refresh the page to see the effect of a setting change. This was a recurring bug across multiple modules — it's now a hard rule.

The pattern has 5 steps. Skipping step 3 or 4 is the most common mistake:

```javascript
// 1. Validate input
if (!isValid(newValue)) return;

// 2. Update in-memory state
state.preferences.someField = newValue;

// 3. Persist to localStorage (REQUIRED)
savePreferences(state.preferences);

// 4. Re-render affected UI (REQUIRED — this is the step people forget)
renderAffectedComponents();

// 5. Show user feedback
showToast('Setting updated', 'success');
```

**For sliders and continuous inputs**, use the debounced variant:

```javascript
let saveTimer = null;
slider.addEventListener('input', () => {
  updateDisplayLabel();               // Instant visual feedback on drag
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    savePreferences(readSliderValues());  // Persist after 500ms idle
    rescoreAndRerender();                 // Re-compute dependent UI
    showToast('Updated', 'success');
  }, 500);
});
```

**Anti-patterns to avoid:**
- Saving to localStorage without re-rendering (`localStorage.setItem(...)` with no render call)
- Updating `state` without persisting (state will be lost on refresh)
- Showing sensitive data (API keys, tokens) in input fields after save — use masked placeholders

**For API keys / tokens:**
```javascript
// After saving, NEVER put the real key back in the input
input.value = key.slice(0, 10) + '...' + key.slice(-4);  // Briefly show masked version
setTimeout(() => {
  input.type = 'password';
  input.value = '••••••••••••••••';  // Placeholder, NOT the real key
}, 3000);
```
