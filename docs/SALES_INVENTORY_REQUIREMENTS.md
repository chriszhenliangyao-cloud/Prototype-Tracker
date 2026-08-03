# Sales & Inventory Planning requirements

## Forecast Archive Mock Data

- Forecast Archive is read only and continues to receive snapshots during
  Month Closing.
- The initial Mock Data includes May and June archive snapshots for July and
  August forecasts so the archive visualization is available on every preview
  origin before the first local Month Closing.
- Existing non-empty browser-local archive data is preserved. The initial
  snapshots are used only when the saved archive is missing or empty.
- The selected forecast month also appends the current live Planning values as
  a clearly labelled `Current` point after the archived months. This live point
  is for comparison only and does not create or overwrite an archive snapshot.
- This seed does not change the current planning month, Planning data, History,
  Month Closing state, or any module outside Sales & Inventory.
- In `All Models`, every visible model combines a mini trend with exact first
  and latest Shipment Forecast and Supply Plan values, their absolute changes,
  and the latest supply gap.
- `All Models` begins with a compact Forecast Changes table containing every
  changed model and sorting by absolute Shipment Forecast change from largest
  to smallest. It uses five columns: Model / Product, the first-to-latest
  Shipment Forecast pair, Change, Current Supply, and Supply Gap. The latest
  value uses current live Planning data when available. Selecting a Model opens
  its details.
- Each mini trend keeps the chart and reduces its right-hand summary to three
  decision fields: Forecast change, Supply change, and Current Gap. The summary
  explicitly labels its comparison period, such as `May → Current`, and avoids
  the ambiguous delta symbol. Exact first and latest forecast values remain
  available in the table above.
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
