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
  Only Gap limits it to SKUs whose cumulative Net Gap is negative across the
  selected period. All KPI cards and Trend modules use the same filtered set.
- Pull History opens read-only Actual Shipment, Actual Supply, and Ending
  Inventory for every available historical month. Beginning Inventory remains
  available to inventory calculations but is not displayed in this table. It
  supports a From/To month range rather than exact calendar dates. Forecast
  Archive remains read only.
- Pull History contains three read-only views: Monthly Actuals, Forecast
  Snapshots, and Revision Log. These provide the inventory baseline, forecast
  comparison source, monthly-close review, and revision audit trail.
- Pull History additionally supports a searchable, multi-select Model filter
  and a Category filter. These filters apply consistently across all three
  history views. Filtered results are grouped by Model first. Within each Model,
  Monthly Actuals run from the oldest month to the newest; Forecast Snapshots
  use archive month then forecast month; Revision Log shows that Model's newest
  changes first. This lets users review the full month sequence for one Model
  before continuing to the next Model.
- Table headers remain frozen inside every scrollable Sales & Inventory modal
  table, including Pull History, Grid Input, comparisons, and snapshot logs.
- The default planning Period is not an editable filter. The active rolling
  three-month window is shown in the Demand–Supply Matrix title and advances
  automatically after Month Closing.

## Trend Analysis

- The Sales & Inventory toolbar provides a `Matrix | Trend` view switch.
  Matrix remains the default view; both views share Model, Category, Lifecycle,
  Only Gap, First Batch Only, and history status. Trend replaces the Matrix
  period label with independent `From` and `To` month selectors; Matrix keeps
  its fixed rolling three-month window.
- `Edit Plan` and `Forecast Archive` belong to Matrix and are hidden in Trend,
  keeping the analysis toolbar focused on filters, history, Month Closing, and
  view switching.
- `Undo Closing` remains available for mock-data testing. Each click restores
  the most recently closed month, its beginning inventory, and the preceding
  three-month planning window without changing other ProtoTrack systems.
- Every Trend result derives from one shared filtered dataset. Changing Model,
  Category, Lifecycle, From, To, Only Gap, or First Batch Only recalculates the
  KPI cards, Monthly Demand vs Supply, SKU Gap Heatmap, EOH Risk Trend, and Top
  Actions together. If From is moved after To (or To before From), the other
  boundary follows automatically so the selected range always remains valid.
- The desktop analysis workspace uses a compact two-column composition: Monthly
  Demand vs Supply spans the left column, SKU Gap Heatmap and EOH Risk Trend are
  stacked in the right column, and Top Actions spans one full-width row below.
  Chart heights are coordinated so the three analysis charts form one balanced
  block without a large empty area.
- Trend reuses the same 3M Demand, 3M Supply, Net Gap, Worst Month, and Stockout
  SKU metrics. Selecting Worst Month opens Trend and highlights that heatmap
  month.
- Monthly Demand vs Supply displays blue Demand, green Supply, and red Net Gap
  bars as one ordered group per month. Net Gap sits immediately to the right of
  Supply and is labelled `Net Gap (S − D)`. The chart includes compact legends,
  visible X/Y axes, value labels, guides, and a clear zero line.
  New-product First Batch events appear below the corresponding month as
  compact red `FB!`, orange `FB~`, or green `FB✓` badges.
- SKU Gap Heatmap uses rows for filtered SKUs and columns for the rolling months.
  Its header contains `Gap (S − D)` plus the Severe, Warning, Healthy, and No
  Data colour legend; explanatory legends are not repeated below the table.
  Severe negative gaps are red, mild negative gaps orange, and healthy gaps
  green. First Batch badges appear only for New SKUs in their first supply month
  and use the same red, orange, and green badge language as Matrix.
- EOH Risk Trend includes only risk and First Batch SKUs, includes a zero-stock
  reference line, visible axes and grid guides, point values, month labels, and
  First Batch event badges. Its Y axis is fixed from `4K` to `−4K`, with ticks at
  `4K`, `2K`, `0`, `−2K`, and `−4K`, so inventory risk remains comparable across
  filters and periods. Point labels use series-specific staggered positions and
  a white text halo so values remain legible near the zero line and at line
  intersections. Series lines and points are visually lightweight, and the
  `Stockout line` label sits in a dedicated right-side gutter beyond the plot
  boundary, so the complete label remains clear without covering plotted values.
  It does not place all SKUs and
  measures in one chart.
- Top Actions from Trend lists the highest-priority Stockout, First Batch Risk,
  Gap, and Watch exceptions. Selecting a heatmap cell or action switches to
  Matrix and highlights the matching SKU and month.
- All Trend values use the same definitions as Matrix: Demand is Shipment
  Forecast, Supply is Supply Plan, Gap is Supply minus Demand, and EOH is Ending
  On Hand. Trend continues to use mock/local data only.

## Rolling Plan Editor

- Edit Plan opens a modal so editing never reduces the matrix workspace.
- Shipment Forecast and Supply Plan are editable only for the active three
  months. Current Inventory is derived from history and is not edited here.
- The compact editor uses one row per SKU and month, with Forecast, Supply
  Plan, and a concise planning comment. It supports Excel/CSV import, a Month
  filter, and a searchable multi-select Model filter. Inline Edit and Paste
  Grid toolbar actions are not shown; values remain directly editable in the
  visible table inputs.
- Import Excel, Month, and Model controls share the same baseline in the editor
  toolbar so the action and both filters remain visually aligned.
- Save Draft stores a separate browser-local editable draft and does not alter
  the published values shown in the Demand–Supply Matrix. Reopening Edit Plan
  resumes that draft and the toolbar indicates that a draft is saved.
- Publish Plan Snapshot applies the draft to the Demand–Supply Matrix, clears
  the draft state, and creates a new read-only Forecast Archive snapshot.
- The Grid Input table header remains frozen while its rows scroll so SKU,
  Month, Forecast, Supply Plan, and Comment stay visible.
- Version History provides working Compare, Restore as Draft, and View Log controls in
  the Mock interface. Change Log records SKU, Month, Field, Before, After,
  User, and Time, and excludes unchanged values. The editor also makes the
  read-only Actuals/History and auto-calculated Current Inventory scope clear.
- Compare renders the differences between the editable draft and the latest
  selected published snapshot. Restore as Draft copies snapshot values into a
  new editable draft without overwriting the archive. View Log opens the
  revisions associated with that snapshot.
- Change Log is not a permanent top-level editor tab. It opens contextually
  inside Version History after View Log is selected, and shows only changes
  associated with that published snapshot instead of mixing all versions.
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

- A one-time local workspace migration restores legacy Sep-or-later test state
  to the Aug–Oct 2026 window with History synced through Jul 2026. It preserves
  the corresponding rolling-plan values and product setup.
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
