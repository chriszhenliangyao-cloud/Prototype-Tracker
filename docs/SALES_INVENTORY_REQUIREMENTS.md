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
