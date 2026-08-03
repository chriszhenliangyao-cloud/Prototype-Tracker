# Project Progress Management Requirements

## Sales and inventory section titles

- The planning table section is titled `Sales & Inventory Overview`.
- Its description explains that the selected period combines historical actuals, future sales forecasts, supply plans, and projected inventory.
- Planning-month and planning-total table headers use `Shipment Forecast` instead of `Forecast`.
- The trend section is titled `Supply & Shipment Trend` with the eyebrow `SUPPLY & SHIPMENT TREND`.
- Its description explains that the chart compares historical actual shipments and supply with future shipment forecasts and supply plans.
- The trend legend uses `Supply` and `Shipment`; `Sales` is not used.
- The Supply legend key is visibly rendered as a horizontal line with a circular point; no redundant `Line` text is shown.
- The Shipment legend key is visibly rendered as a vertical column; no redundant `Bar` text is shown.
- The trend Model filter accepts at most four explicitly selected Models.
- After four Models are selected, all remaining unchecked Models are disabled and visually muted. Removing one selected Model immediately makes the remaining options available again.
- The four-Model limit applies only to the trend visualization and does not restrict the Planning table Model filter.
- Every Sales & Inventory Model multi-select places a `Search Model` input at the top of its menu.
- Model search is case-insensitive and supports partial Model matches so large product lists remain usable.
- Searching narrows only the visible options and does not clear Models that are already selected.
- A concise `No matching Models` message is displayed when the search has no results.
- Long Model lists scroll inside the menu while the search input remains visible at the top.
- Each product uses one consistent, accessible color across its Supply line and Shipment bars.
- Supply and Shipment remain distinguishable by geometry: Supply is a line and Shipment is a bar.
- Marker shapes, line dashes, and bar textures remain as secondary identifiers, while legend hover/focus highlights one product and dims the others.

## Fixed rolling summary cards

- The summary cards are fixed planning indicators, not selected-period summaries.
- They always show all-product totals for the current open month plus the following three planning months.
- The first card is titled `Rolling 4-Month Shipment Forecast`; the second is titled `Rolling 4-Month Supply Plan`.
- Each card states `All Products` and its exact four-month range directly below the title.
- The cards do not respond to Model, Category, From, or To filters, eliminating mixed filter scope and historical-period ambiguity.
- Exactly four months are displayed without horizontal scrolling.
- Month Closing rolls the cards forward by one month together with the Planning window.

## Monthly forecast archive

- `Forecast Archive` is available from the Sales & Inventory Overview toolbar.
- Confirming Month Closing creates a read-only snapshot before the planning window rolls forward.
- Each snapshot stores the three future planning months that follow the closed month. For example, closing July archives the August, September, and October Shipment Forecast and Supply Plan values.
- Snapshots also retain Model, Product, Category, and Projected On Hand context and persist in browser localStorage with the rest of the mock workspace.
- Archived values never change when the live planning table is edited later.
- The archive modal filters by Forecast Month, Model, From Archive, and To Archive.
- `All Models` displays every available archive version in the selected range, rather than limiting comparison to adjacent months.
- The archive visualization lists only Models whose Shipment Forecast changed within the selected archive range. Models with identical forecast values throughout the range are hidden.
- Complete snapshots are still retained internally as comparison baselines, including unchanged values, so future changes can be compared against the correct earlier version and its corresponding Supply Plan.
- When the selected range contains no Shipment Forecast changes, the modal shows a concise empty-state message instead of unchanged model rows.
- Each model uses a compact two-line trend: blue for Shipment Forecast and green for Supply Plan. A red gap indicator marks archive versions where Shipment Forecast is greater than Supply Plan.
- The right side of each model row shows the absolute Shipment Forecast and Supply Plan changes from the first visible archive to the latest visible archive. Percentages are not used.
- Selecting a model opens a larger read-only trend with exact values at every saved archive point and a return control for `All Models`.
- If no snapshots exist, the modal explains that Month Closing is required to create the first archive.

## Rolling forecast window

- Planning always maintains the current open month plus the following three months.
- On initial load and after refreshing the browser, the default From/To filters select the current open month through the third future planning month.
- Month Closing rolls both the underlying planning data and the visible From/To range forward by one month.
- For example, closing July changes the default Planning view from July–October to August–November.
- The newly added fourth month is created for every product with Shipment Forecast and Supply Plan set to `0`, ready for entry through Edit Table.
- Earlier closed months remain available by changing the From filter; automatic rolling changes only the default visible window.
- Undo Closing restores the previous four-month window and its previous From/To range.

## Reverting Month Closing

- After Month Closing, the Sales & Inventory Overview toolbar displays `Undo Closing` for the most recently completed closing.
- Only the latest closing can be reverted. A new closing replaces the previous undo checkpoint.
- Undo requires confirmation and restores the complete state from immediately before that closing: Planning rows, the four-month planning window, beginning inventory, History, previous closed-month status, and Forecast Archive snapshots.
- Changes made after the closing are discarded when the closing is undone; the confirmation message states this explicitly.
- After a successful undo, the checkpoint is cleared so the same closing cannot be undone twice.
- The undo checkpoint is stored in localStorage so the testing control remains available after refreshing the browser.

## Task completion

- The circle before a task toggles that task between completed and unfinished.
- The toggle updates optimistically and persists `is_completed` through the
  Project Progress route action.
- Progress, Project Status, Current Stage, stage-card colors, and the Project
  Pipeline recalculate immediately.
- Toggling a completed task back to unfinished may move Current Stage back to
  that task's stage.

## Project status and DDL reminder

- Project Status has exactly three values: `Completed`, `On Track`, and
  `Delayed`. `At Risk` is not used.
- Status is editable directly from the Status column and is persisted in D1.
- Once a current stage enters the zero-to-seven-day window before its DDL, a
  prominent yellow `Follow Up` label is shown until a user confirms one of the
  three project statuses. Projects already inside that window when this
  feature is introduced also receive the reminder.
- After the current stage status is confirmed, both the `Update` control and
  the `Follow Up` label disappear.
- A stage receives this reminder only once. Overdue stages do not generate a
  new seven-day reminder.
- A status confirmation is associated with the current stage. If task changes
  move the project to another stage, that next stage can generate its own
  seven-day reminder.
- Reopening a completed task clears the project's previous status confirmation.
  If the resulting current stage DDL is within zero to seven days, the yellow
  `Follow Up` label and `Update` control appear again.
- Completed projects display `Completed` and do not show a reminder.

## Delay Records editing

- The Status column uses a text entry in the form `Delay Records (count)`.
- Selecting it opens a centered modal table. Its first column numbers the
  product history as `Delay 1`, `Delay 2`, and so on.
- Changing an existing stage DDL automatically creates a new historical Delay
  Record containing the old and new DDL. Initial entry of a blank DDL does not
  create a Delay Record.
- The table combines Stage and Task Name as `Delay Item`, combines the old and
  new dates as `DDL Change`, and includes a read-only `Mass Production` column.
- `Mass Production` shows the Mass Production DDL impact caused by the Stage
  DDL change in the form `previous date → recalculated date`. When the delay is
  absorbed without moving downstream dates, it shows
  `No impact · Remains YYYY-MM-DD`.
- A Delay Record is created only when a task is incomplete and its stage DDL
  has been reached or passed.
- Once created, a Delay Record remains in history even if the task is later
  completed.
- Every Delay Record provides an `Edit` button.
- Every Delay Record provides a `Delete` button with a confirmation prompt.
- Confirmed deletion removes the record from the UI and prevents the automatic
  delay synchronizer from recreating it.
- Edit mode allows changes only to `Delayed Until` and `Notes`.
- Changing `Delayed Until` keeps downstream Stage DDLs fixed by default. An
  explicit `Shift downstream dates` checkbox applies the temporary seven-day
  cascade and recalculates the read-only Mass Production impact.
- Saving Notes without changing `Delayed Until` preserves the previously
  calculated Mass Production impact.
- `Save` persists the changes; `Cancel` discards unsaved changes.
- Stage, Task Name, Original DDL, and Mass Production impact remain read-only
  and are not submitted as editable values.
- Editing only Notes does not change project tasks, stage deadlines, materials,
  prototype requirements, or ProtoTrack sample data. Editing `Delayed Until`
  changes only this product's Project Progress Stage DDLs, following the
  selected downstream-impact option; other modules and source data remain
  untouched.

## Temporary Stage DDL back-planning rule

- The temporary testing rule uses the product Launch Date as the planning
  anchor and spaces every Project Progress stage seven calendar days apart.
- The initial offsets are: Project Confirm to Start `Launch - 35 days`, DVT1
  `Launch - 28 days`, DVT2 `Launch - 21 days`, Trial Production Start
  `Launch - 14 days`, Mass Production `Launch - 7 days`, and Launch `0 days`.
- Newly created Project Progress products receive these calculated Stage DDLs
  automatically from their Launch Date.
- In the Project editor, changing one Stage DDL displays two downstream-impact
  choices. `Keep downstream dates` is selected by default so available buffer
  absorbs the delay and every other Stage retains its saved DDL.
- Selecting `Shift downstream dates` recalculates every later Stage using the
  seven-day interval through Mass Production. Earlier stages are not changed,
  and the Launch Stage remains fixed to the product Launch Date.
- The Launch Stage DDL is disabled in the Project editor and is also protected
  by the server. Neither downstream shifting nor a submitted project payload
  can change the product's Launch Date.
- The server enforces the selected behavior when the project is saved. In the
  default keep mode, a client payload cannot move unrelated Stage DDLs; in
  shift mode, the server applies the downstream calculation itself.
- A yellow helper message in edit mode identifies this as a temporary rule.
- Only the manually edited source Stage creates a `Stage DDL Change` Delay
  Record; automatically shifted downstream stages do not create duplicate
  records.
- Restoring a downstream date is unnecessary in keep mode and therefore does
  not create a compensating Delay Record.
- The Delay Record stores the resulting Mass Production DDL change for future
  review.
- This temporary interval is isolated to Project Progress and can later be
  replaced by the final product-specific back-planning configuration without
  changing Sales & Inventory, Product Material, Prototype Management, or
  Control Tower behavior.

## Sample task navigation and status

- Clicking the name of a task with a `prototype_type` opens Prototype
  Management, scrolls to the matching `source_task_id`, and highlights the row
  for approximately 2.5 seconds.
- Prototype status is derived from the linked project task:
  - `Completed`: the linked task is completed.
  - `In Process`: the linked task is unfinished and belongs to Current Stage.
  - `Planned`: the linked task belongs to a later stage.
- Task completion remains the single source of truth, so Project Progress and
  Prototype Management update together without a duplicate status field.

## Prototype allocation details

- Every Prototype Management row provides `Edit` and `Detail` actions.
- `Detail` opens a right-side drawer containing only Country, Channel, and
  Quantity.
- Allocation data comes directly from Control Tower's `prototype` table.
- Requirements match Control Tower records by normalized Model and Sample Type.
- Rows with the same Country and Channel are grouped, and their `qty` values
  are summed.
- `Required Quantity` is read-only and is recalculated from the same Control
  Tower allocation rows on every page load. It is the sum of all positive
  `prototype.qty` values matching the same normalized Model and Sample Type
  where Channel is present.
- Control Tower's `customer` field is displayed as Channel.
- Control Tower rows without a Channel are unallocated inventory and are
  excluded from the allocation drawer.
- Prototype status, requirement totals, serial numbers, and logistics fields
  are not displayed in the allocation drawer.

## Marketing task navigation

- Clicking the name of a task owned by `MARKETING` opens Product Material
  Management.
- The target is matched by the same `product_id` and by an exact match between
  the project task name and `material_type`.
- The matching product row scrolls into view and uses the same approximately
  2.5-second whole-row highlight as Prototype Management.

## Marketing task and material status synchronization

- A completed `MARKETING` task sets the matching Product Material record to
  `COMPLETED`.
- Reopening a `MARKETING` task sets the matching Product Material record to
  `NOT_COMPLETED`.
- Deleting a `MARKETING` task through the project editor sets the matching
  Product Material record to `NOT_REQUIRED`.
- Matching uses the same `product_id` and exact task/material name. Task and
  material changes are submitted together in one D1 batch.

## Excel import

- Project Progress provides an `Import Excel` control in the upper-right corner.
- The workbook uses four named sheets: `Products`, `Stages`, `Tasks`, and
  `Materials`.
- Import can update existing records and create missing project, stage, task,
  material, and prototype-requirement records. Existing records are matched by
  Model and their corresponding natural keys.
- Excel is parsed in the browser. Only validated structured data is submitted
  to the route action; the original workbook file is not uploaded.
- Dates must use `YYYY-MM-DD`. Stage names, owner roles, and material statuses
  are validated before the D1 batch is applied.
- Sample tasks can include `ETA`; imported sample tasks remain visible in
  Prototype Management. `Required Quantity` is not manually editable and is
  always derived from current Control Tower allocations.
- When Tasks and Materials sheets contain the same marketing material, the
  task's completion state is applied last and remains the source of truth.

## Product Material summary cards

- Counts use only the products visible after applying the current search,
  category, and model filters.
- `Upcoming Products` counts products whose `launch_status` is `UNLAUNCHED` and
  always uses a white card.
- `Launched Products (Complete)` counts products whose `launch_status` is
  `LAUNCHED` and whose materials are all `COMPLETED` or `NOT_REQUIRED`; its card
  is green.
- `Launched Products (Incomplete)` counts the remaining launched products.
  Its card is white at zero, yellow from one through three, and red above three.
- All three cards are clickable table filters. `Upcoming Products` is selected
  by default.
- Selecting a card limits the material table to that category while preserving
  the current search, category, and model filters.

## Product launch lifecycle

- Every Project Progress row has an `Action` column with a `Launch` button.
- Launch sets the product's `launch_status` to `LAUNCHED`; React Router
  revalidation then removes it from Project Progress.
- Product Material Management always shows both upcoming and launched products.
- Launched product rows provide a professional `Return to Upcoming` action,
  which restores `launch_status` to `UNLAUNCHED` and returns the project to
  Project Progress.

## Product creation

- Project Progress places `Add Product` immediately after the `All Models`
  filter.
- Clicking the button expands an inline card below the filter toolbar.
- The card contains exactly Model, Product Name, Category, and Launch Date.
- Creating a product generates the standard six project stages, ten standard
  tasks, linked marketing materials, and four prototype requirements.
- Every generated stage DDL and prototype ETA starts blank and can be completed
  later through the existing project and prototype editors.
- Prototype Management does not provide a separate `Add Prototype` button;
  prototype requirements originate from sample tasks in the project pipeline.

## Demo material provenance

- `Launch Assets Archive` was introduced by the GTM demo seed migrations.
- `Launch Assets Archive` is retained only as historical seed data and is not
  displayed or included in Product Material Management readiness calculations.
- It is not sourced from the original ProtoTrack prototype-management records.
- It remains isolated in `gtm_material_task` and does not alter the original
  prototype tables.
