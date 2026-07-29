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
- The matching material cell scrolls into view and is highlighted for
  approximately 2.5 seconds.

## Demo material provenance

- `Launch Assets Archive` was introduced by the GTM demo seed migrations.
- It is not sourced from the original ProtoTrack prototype-management records.
- It remains isolated in `gtm_material_task` and does not alter the original
  prototype tables.
