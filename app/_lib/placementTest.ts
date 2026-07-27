/** Where setting up a language sends everyone, signed in or not. */
export const PLACEMENT_TEST_HREF = "/level-test?placement=1";

export function isPlacementTest(params: {
  get: (key: string) => string | null;
}): boolean {
  return params.get("placement") === "1";
}
