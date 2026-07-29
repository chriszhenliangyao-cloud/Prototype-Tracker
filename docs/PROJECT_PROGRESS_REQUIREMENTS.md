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
- Edit mode allows changes only to `Delayed Until` and `Notes`.
- `Save` persists those fields; `Cancel` discards unsaved changes.
- Stage, Task Name, and Original DDL remain read-only and are not submitted as
  editable values.
- Editing a Delay Record does not change project tasks, stage deadlines,
  materials, prototype requirements, or ProtoTrack sample data.
