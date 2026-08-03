# Sales & Inventory Planning requirements

## Forecast Archive Mock Data

- Forecast Archive is read only and continues to receive snapshots during
  Month Closing.
- The initial Mock Data includes May and June archive snapshots for July and
  August forecasts so the archive visualization is available on every preview
  origin before the first local Month Closing.
- Existing non-empty browser-local archive data is preserved. The initial
  snapshots are used only when the saved archive is missing or empty.
- This seed does not change the current planning month, Planning data, History,
  Month Closing state, or any module outside Sales & Inventory.
- In `All Models`, every visible model combines a mini trend with exact first
  and latest Shipment Forecast and Supply Plan values, their absolute changes,
  and the latest supply gap.
- `All Models` begins with a Forecast Change Ranking table containing every
  changed model and sorting by absolute Shipment Forecast change from largest
  to smallest. It shows previous and latest Forecast, Forecast Change, latest
  Supply Plan, and latest Gap; selecting a Model opens its details.
- Selecting one model opens a detailed trend followed by a read-only archive
  table containing Archive Month, Shipment Forecast, Shipment Change, Supply
  Plan, Supply Change, and Gap.
- `Gap = Supply Plan - Shipment Forecast`; negative gaps are red and
  non-negative gaps are green. Percentages are not used.

## Month Closing test rollback

- `Undo Closing` is always visible in Sales & Inventory during testing.
- Every Month Closing adds a browser-local recovery point instead of replacing
  the previous recovery point.
- Each Undo restores one month, including Planning rows, History, Forecast
  Archive, filters' date range, and the previous closed-month label.
- Undo applies immediately without a browser confirmation dialog so it remains
  reliable in local and hosted preview environments.
- Undo can be repeated to return through multiple locally closed months.
- For months closed before the multi-level recovery stack was introduced, the
  previous Planning state is reconstructed from the closed month's History so
  legacy test data can still be undone one month at a time.
- `Aug Open / Jul Closed` can always return to the explicit July Mock Data
  baseline even when an older browser workspace does not contain a complete
  July History recovery record.
- When no earlier recovery point exists, the button remains visible but is
  disabled.
