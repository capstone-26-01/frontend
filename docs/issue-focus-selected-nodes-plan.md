# Issue Focus Selected Nodes Plan

## Goal

When a GitHub issue is selected, the React Flow canvas should show exactly the nodes returned in `selected_node_ids` plus their parent/ancestor nodes from the `contains` hierarchy. When the issue is deselected, the graph should return to the existing normal graph behavior.

## Non-Goals

- Do not change backend APIs or ranking behavior.
- Do not change `app/chat/page.tsx` issue fetching or chat behavior.
- Do not add new UI controls.
- Do not use `focus_graph` for this change.
- Do not refactor `GraphFlow.tsx` beyond the visibility/layout path needed for this feature.

## Existing Flow

- `app/chat/page.tsx` calls `fetchIssueRelatedNodes` when an issue is selected.
- It stores `new Set(data.selected_node_ids)` in `issueHighlightIds`.
- `GraphFlow` receives `issueHighlightIds`.
- `GraphFlow` currently dims issue-unrelated nodes and edges instead of hiding them.
- `GraphFlow` currently drops `method` and `external` nodes during API ingestion before React Flow can render them.

## Minimal Implementation

All runtime behavior changes should stay in `public/components/GraphFlow.tsx`.

1. Define issue focus mode:

   ```ts
   const issueFocusIds = issueHighlightIds;
   const issueFocusActive = issueFocusIds !== null;
   ```

   `null` means no issue is selected. An empty set means an issue is selected but no graph nodes were matched, so no nodes should be visible.

   Derive the render set from `issueFocusIds` plus every ancestor reachable through `hierarchy.parentMap`.

2. Keep all API nodes and API edges in React Flow state.

   Remove the ingestion-time `HIDDEN_KINDS` filtering for both nodes and edges. Ingest all supported API nodes and all API edges. Keep normal default hiding of `method` and `external` in derived visibility only.

   Preserve `method` and `external` as distinguishable node kinds in `data.kind`; do not coerce them to `concrete`. The existing `KIND_THEME` contains both kinds, so the current fallback path should only apply to unknown future kinds.

3. Add one derived node visibility predicate.

   Normal mode:

   - hide `method` and `external`
   - apply the existing view-level filter
   - apply the existing collapsed-ancestor filter

   Issue focus mode:

   - visible iff the node is selected or is an ancestor of a selected node
   - ignore view-level and collapsed-ancestor filters
   - keep selected nodes highlighted and not dimmed
   - keep ancestor nodes visible but not highlighted as selected

4. Add one derived edge visibility predicate.

   Normal mode:

   - apply the existing active edge-kind filter
   - visible iff both endpoints pass the node visibility predicate

   Issue focus mode:

   - visible iff both `source` and `target` are in the selected-plus-ancestors render set
   - ignore active edge-kind filters so selected issue nodes are not disconnected by toolbar state

   Do not let the existing `visibleEdges` prefilter remove issue-focus edges before this predicate runs. Introduce a small issue-aware edge source:

   ```ts
   const issueEdges = issueVisibleIds
     ? edges.filter(e => issueVisibleIds.has(e.source) && issueVisibleIds.has(e.target))
     : [];
   const edgeRenderSource = issueFocusActive ? issueEdges : visibleEdges;
   ```

   `visibleEdges` can remain the normal-mode active-edge-kind filtered source. Do not use raw `edges` as the issue-focus render source, because hidden non-issue edges would still affect edge bundling counts.

5. Use the node predicate in `displayNodes`.

   Set `hidden` from the predicate. In issue focus mode, selected nodes should have `highlighted: true` and `dimmed: false`; ancestor nodes should be visible without selected highlighting; all other nodes are hidden rather than dimmed.

6. Use the edge predicate in `displayEdges`.

   Set `hidden` from the predicate. In issue focus mode, only edges whose endpoints are both in the selected-plus-ancestors render set render. Selected nodes still render if there are no focus-set edges.

   `displayEdges`, edge bundling source counts, and hover-neighbor detection in `displayNodes` must use the same issue-visible edge source so active edge-kind toolbar state and hidden non-issue edges cannot affect issue focus mode.

7. Reuse the visibility predicates in layout.

   `layoutVisible` should lay out only currently visible nodes and currently visible edges. It should depend on the issue focus state, either by receiving the predicates as inputs or by including the issue focus state in its `useCallback` dependencies.

   The layout effect must rerun when issue focus changes, so it must depend on the issue focus state as well as the existing expansion, view-level, and layout state.

   The general layout effect's broad `fitView({ padding: 0.2, ... })` must not also run while issue focus is active. Skip that general fit-view call in issue focus mode, or fold the issue-specific fit-view behavior into the same effect. There should be only one camera fit for an issue selection.

8. Replace the current issue-focus effect.

   The current effect expands ancestors and filters fit-view targets through normal view-level visibility. Replace it with a smaller effect:

   - if no issue is selected, do nothing
   - if selected ID set is empty, do nothing
   - otherwise, after layout settles, call `fitView` with selected and ancestor IDs that exist in current `nodes`
   - do not expand ancestors, because issue focus visibility ignores collapsed ancestors

9. Scope search while issue focus is active.

   Search should only consider visible issue nodes while issue focus is active, so it cannot jump to hidden non-issue nodes.

## Validation

- Select an issue with multiple selected nodes: only those nodes and their ancestors render.
- Select an issue whose selected node is a `method`: that node renders.
- Select an issue with zero selected nodes: no graph nodes render.
- Deselect the issue: normal graph behavior returns.
- Change File/Class/Func while an issue is selected: issue-only visibility remains.
- Toggle edge kinds while an issue is selected: issue-only edge visibility remains.
- Deselect after changing File/Class/Func: normal view-level behavior applies.
- Search while an issue is selected: search targets only selected visible nodes.
- Click a visible issue node: chat node context still opens.
- Existing normal-mode method/external suppression remains.
- Issue selection does not trigger competing general and issue-specific `fitView` calls.
- `npm run build` passes.

## Expected Files Touched

- `public/components/GraphFlow.tsx`
