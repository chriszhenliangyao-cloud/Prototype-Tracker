# Project Progress Management Requirements

## Task completion

- The circle before a task toggles that task between completed and unfinished.
- The toggle updates optimistically and persists `is_completed` through the
  Project Progress route action.
- Progress, Project Status, Current Stage, stage-card colors, and the Project
  Pipeline recalculate immediately.
- Toggling a completed task back to unfinished may move Current Stage back to
  that task's stage.

## Delay Records editing

- Every Delay Record provides an `Edit` button.
- Every Delay Record provides a `Delete` button with a confirmation prompt.
- Confirmed deletion permanently removes only that `gtm_delay_record` row.
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

- Project Progress provides `Excel Template` and `Import Excel` controls in the
  upper-right corner.
- The workbook uses four named sheets: `Products`, `Stages`, `Tasks`, and
  `Materials`.
- Import can update existing records and create missing project, stage, task,
  material, and prototype-requirement records. Existing records are matched by
  Model and their corresponding natural keys.
- Excel is parsed in the browser. Only validated structured data is submitted
  to the route action; the original workbook file is not uploaded.
- Dates must use `YYYY-MM-DD`. Stage names, owner roles, and material statuses
  are validated before the D1 batch is applied.
- Sample tasks can include `Required Quantity` and `ETA`; imported sample tasks
  remain visible and editable in Prototype Management.
- When Tasks and Materials sheets contain the same marketing material, the
  task's completion state is applied last and remains the source of truth.

## Product Material summary cards

- Counts use only the products visible after applying the current search,
  category, and model filters.
- `Upcoming Products` counts products whose Launch Date is later than today and
  always uses a white card.
- `Launched Products (Complete)` counts products whose Launch Date is today or
  earlier and whose materials are all `COMPLETED` or `NOT_REQUIRED`; its card is
  green.
- `Launched Products (Incomplete)` counts the remaining launched products.
  Its card is white at zero, yellow from one through three, and red above three.

## Demo material provenance

- `Launch Assets Archive` was introduced by the GTM demo seed migrations.
- It is not sourced from the original ProtoTrack prototype-management records.
- It remains isolated in `gtm_material_task` and does not alter the original
  prototype tables.
