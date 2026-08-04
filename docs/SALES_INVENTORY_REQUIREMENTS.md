# Sales & Inventory Planning requirements

## Default Demand–Supply Matrix

- The default Sales & Inventory page is a read-only, high-density decision
  view for the current three-month rolling window. The Mock baseline is
  August through October 2026; historical months are not expanded in the main
  matrix.
- The compact toolbar contains Pull History and its last synced month, Model
  search/filter, Category, Lifecycle (All / New / Launched), Period, Only Gap,
  First Batch Only, Edit Plan, Forecast Archive, and Month Closing.
- The Sales & Inventory title occupies its own row. All toolbar controls sit
  together on the row beneath it and must fit without horizontal scrolling.
- The KPI row shows 3M Demand, 3M Supply, Net Gap, Worst Month, and Stockout
  SKU. Negative gaps and stockouts use risk styling.
- In Worst Month, the month and year remain neutral black while only the gap is
  red. Stockout SKU uses a red triangle containing an exclamation mark as its
  attention icon.
- The Demand–Supply Matrix uses Model, Product, Lifecycle, Launch, Current
  Inventory, three monthly cells, 3M Gap, and Risk. Each monthly cell displays
  Demand, Supply, `Gap = Supply - Demand`, and Ending On Hand. Ending On Hand
  rolls forward as `previous EOH + Supply - Demand`.
- The Exception Board contains Stockout, First Batch Risk, Gap, and Watch
  issues. Selecting an exception scrolls to and temporarily highlights the
  corresponding SKU and month in the matrix.
- Stockout and First Batch Risk controls, Type values, and Issue values use
  red. Gap and Watch use orange. Lifecycle headers and Launched/New badges
  remain on one line without breaking words.
- Lifecycle is derived from Launch Date relative to the first month in the
  active window. All is the default; New and Launched filters limit the same
  matrix rather than opening separate views.
- First Batch is a lightweight event badge in the first month where a New SKU
  has Supply. Supply before that month is zero in the Mock baseline. `FB!`
  means risk, `FB~` means watch, and `FB✓` means OK. Launched SKUs never show a
  First Batch badge.
- First Batch Only limits the matrix to New SKUs with a First Batch event.
  Only Gap limits it to SKUs with at least one negative monthly supply gap.
- Pull History opens read-only Actual Shipment, Actual Supply, Beginning
  Inventory, and Ending Inventory. Forecast Archive remains read only.

## Rolling Plan Editor

- Edit Plan opens a modal so editing never reduces the matrix workspace.
- Shipment Forecast and Supply Plan are editable only for the active three
  months. Current Inventory is derived from history and is not edited here.
- The editor supports inline cells, clipboard grid paste, Excel/CSV import,
  and applying one selected SKU's grid to the other Mock rows for testing.
- Save Draft updates the browser-local Mock workspace. Publish Plan Snapshot
  also creates a new read-only Forecast Archive snapshot.
- Version History provides Compare, Restore, and View Log controls in the Mock
  interface. Change Log records SKU, Month, Field, Before, After, User, and
  Time, and excludes unchanged values.
- Month Closing archives actuals, rolls the window forward by one month,
  carries Ending Inventory into the next period, retains the remaining plan,
  and creates the new far month with zero Forecast and Supply.
- This feature continues to use Mock Data and browser localStorage only. It
  does not add or modify database-backed Sales & Inventory data and does not
  change any other ProtoTrack module.

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
- `To Archive` only offers the first and second month following the selected
  `From Archive`. For example, selecting July offers August and September; the
  current live month is included as an option and labelled `Current`.
- This seed does not change the current planning month, Planning data, History,
  Month Closing state, or any module outside Sales & Inventory.
- `All Models` begins with a compact Forecast Changes table containing every
  changed model and sorting by absolute Shipment Forecast change from largest
  to smallest. It uses five columns: Model / Product, the first-to-latest
  Shipment Forecast pair, Change, Current Supply, and Supply Gap. The latest
  value uses current live Planning data when available. Selecting a Model opens
  its details. The entire table row is selectable by mouse or keyboard.
- The repeated mini trend list is not shown in `All Models`. Selecting any row
  in Forecast Changes opens that model's single detailed trend and read-only
  archive table, avoiding duplicate charts on the overview.
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
