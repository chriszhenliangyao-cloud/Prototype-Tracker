# Project Progress Management Requirements

## Sales and inventory section titles

- The planning table section is titled `Sales & Inventory Overview`.
- Its description explains that the selected period combines historical actuals, future sales forecasts, supply plans, and projected inventory.
- Planning-month and planning-total table headers use `Shipment Forecast` instead of `Forecast`.
- The trend section is titled `Supply & Sales Trend` with the eyebrow `SALES & SUPPLY TREND`.
- Its description explains that the chart compares historical actuals with future supply plans and sales forecasts.
- The trend legend uses the neutral labels `Supply` and `Sales` because the chart can include both historical and future months.
- Each product uses one consistent, accessible color across its Supply line and Sales bars.
- Supply and Sales remain distinguishable by geometry: Supply is a line and Sales is a bar.
- Marker shapes, line dashes, and bar textures remain as secondary identifiers, while legend hover/focus highlights one product and dims the others.

## Monthly forecast archive

- `Forecast Archive` is available from the Sales & Inventory Overview toolbar.
- Confirming Month Closing creates a read-only snapshot before the planning window rolls forward.
- Each snapshot stores the three future planning months that follow the closed month. For example, closing July archives the August, September, and October Shipment Forecast and Supply Plan values.
- Snapshots also retain Model, Product, Category, and Projected On Hand context and persist in browser localStorage with the rest of the mock workspace.
- Archived values never change when the live planning table is edited later.
- The archive modal filters by Forecast Month, Model, From Archive, and To Archive.
- `All Models` displays every available archive version in the selected range, rather than limiting comparison to adjacent months.
- Each model uses a compact two-line trend: blue for Shipment Forecast and green for Supply Plan. A red gap indicator marks archive versions where Shipment Forecast is greater than Supply Plan.
- The right side of each model row shows the absolute Shipment Forecast and Supply Plan changes from the first visible archive to the latest visible archive. Percentages are not used.
- Selecting a model opens a larger read-only trend with exact values at every saved archive point and a return control for `All Models`.
- If no snapshots exist, the modal explains that Month Closing is required to create the first archive.

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
  new dates as `DDL Change`, and includes a manually editable `Schedule Impact`
  column.
- A Delay Record is created only when a task is incomplete and its stage DDL
  has been reached or passed.
- Once created, a Delay Record remains in history even if the task is later
  completed.
- Every Delay Record provides an `Edit` button.
- Every Delay Record provides a `Delete` button with a confirmation prompt.
- Confirmed deletion removes the record from the UI and prevents the automatic
  delay synchronizer from recreating it.
- Edit mode allows changes only to `Delayed Until` and `Notes`.
- `Save` persists those fields; `Cancel` discards unsaved changes.
- Stage, Task Name, and Original DDL remain read-only and are not submitted as
  editable values.
- Editing a Delay Record does not change project tasks, stage deadlines,
  materials, prototype requirements, or ProtoTrack sample data.

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
