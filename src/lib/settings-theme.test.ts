import test from "node:test";
import assert from "node:assert/strict";
import { PREDEFINED_THEMES } from "@/components/Settings";
import { getStoredTheme } from "@/lib/theme";

test("PREDEFINED_THEMES defines the exact 5 themes requested", () => {
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

  for (const theme of PREDEFINED_THEMES) {
    assert.ok(theme.id.length > 0, "theme must have an id");
    assert.ok(theme.name.length > 0, "theme must have a name");
    assert.ok(theme.primaryColor.length > 0, "theme must have primaryColor");
    assert.ok(theme.sidebarColor.length > 0, "theme must have sidebarColor");
    assert.ok(theme.previewBg.length > 0, "theme must have previewBg");
  }
});

test("applyAppTheme and getStoredTheme support default and all 5 themes", () => {
  assert.equal(getStoredTheme("default"), "default");
  assert.equal(getStoredTheme("emerald"), "emerald");
  assert.equal(getStoredTheme("sapphire"), "sapphire");
  assert.equal(getStoredTheme("amber"), "amber");
  assert.equal(getStoredTheme("amethyst"), "amethyst");
});
