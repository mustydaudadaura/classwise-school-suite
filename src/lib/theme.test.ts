import test from "node:test";
import assert from "node:assert/strict";
import { APP_THEMES, PREDEFINED_THEMES, getStoredTheme } from "./theme";

test("APP_THEMES contains exactly 5 polished themes with valid configurations", () => {
  assert.equal(APP_THEMES.length, 5);
  const ids = APP_THEMES.map((t) => t.id);
  assert.deepEqual(ids, ["royal", "emerald", "sapphire", "amber", "amethyst"]);

  for (const theme of APP_THEMES) {
    assert.ok(theme.id.length > 0);
    assert.ok(theme.name.length > 0);
    assert.ok(theme.primaryColor.length > 0);
    assert.ok(theme.sidebarColor.length > 0);
    assert.ok(theme.previewBg.length > 0);
  }
});

test("PREDEFINED_THEMES contains default, emerald, sapphire, amber, and amethyst", () => {
  assert.equal(PREDEFINED_THEMES.length, 5);
  const ids = PREDEFINED_THEMES.map((t) => t.id);
  assert.deepEqual(ids, ["default", "emerald", "sapphire", "amber", "amethyst"]);

  const names = PREDEFINED_THEMES.map((t) => t.name);
  assert.deepEqual(names, [
    "Alegacy Navy & Blue",
    "Emerald Green & Gold",
    "Sapphire & Oxford Blue",
    "Warm Amber & Bronze",
    "Imperial Amethyst & Slate",
  ]);
});

test("getStoredTheme falls back to royal default if invalid", () => {
  assert.equal(getStoredTheme("non_existent"), "royal");
  assert.equal(getStoredTheme(null), "royal");
  assert.equal(getStoredTheme("default"), "default");
  assert.equal(getStoredTheme("emerald"), "emerald");
  assert.equal(getStoredTheme("sapphire"), "sapphire");
  assert.equal(getStoredTheme("amber"), "amber");
  assert.equal(getStoredTheme("amethyst"), "amethyst");
});

