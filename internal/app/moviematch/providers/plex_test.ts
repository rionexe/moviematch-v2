import { assert } from "/deps.ts";
import { createProvider } from "/internal/app/moviematch/providers/plex.ts";

try {
  const TEST_PLEX_URL = Deno.env.get("TEST_PLEX_URL");
  const TEST_PLEX_TOKEN = Deno.env.get("TEST_PLEX_TOKEN");

  assert(
    !!TEST_PLEX_URL,
    "TEST_PLEX_URL is required for testing Plex API integration",
  );
  assert(
    !!TEST_PLEX_TOKEN,
    "TEST_PLEX_TOKEN is required for testing Plex API integration",
  );

  Deno.test("providers -> plex -> getFilters", async () => {
    const provider = createProvider("0", {
      url: TEST_PLEX_URL!,
      token: TEST_PLEX_TOKEN!,
      libraryTypeFilter: ["movie"],
    });

    const filters = await provider.getFilters();

    assert(!!filters);
  });
} catch (err) {
  console.error(err);
}
