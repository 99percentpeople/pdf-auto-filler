import { For, Show, splitProps } from "solid-js";
import { TreeView as TreeViewPrimitive } from "@ark-ui/solid";
interface Child {
  value: string;
  name: string;
  children?: Child[];
}

export interface TreeViewData {
  label: string;
  children: Child[];
}

export interface TreeViewProps extends TreeViewPrimitive.RootProps {
  data: TreeViewData;
}
export const TreeView = (props: TreeViewProps) => {
  const [localProps, rootProps] = splitProps(props, ["data"]);

  const renderChild = (child: Child) => (
    <Show
      when={child.children}
      fallback={
        <TreeViewPrimitive.Item value={child.value}>
          <TreeViewPrimitive.ItemText>{child.name}</TreeViewPrimitive.ItemText>
        </TreeViewPrimitive.Item>
      }
    >
      <TreeViewPrimitive.Branch value={child.value}>
        <TreeViewPrimitive.BranchControl>
          <TreeViewPrimitive.BranchIndicator>
            <ChevronRightIcon />
          </TreeViewPrimitive.BranchIndicator>
          <TreeViewPrimitive.BranchText>
            {child.name}
          </TreeViewPrimitive.BranchText>
        </TreeViewPrimitive.BranchControl>
        <TreeViewPrimitive.BranchContent>
          <For each={child.children}>{(child) => renderChild(child)}</For>
        </TreeViewPrimitive.BranchContent>
      </TreeViewPrimitive.Branch>
    </Show>
  );

  return (
    <TreeViewPrimitive.Root aria-label={localProps.data.label} {...rootProps}>
      <TreeViewPrimitive.Tree>
        <For each={localProps.data.children}>
          {(child) => renderChild(child)}
        </For>
      </TreeViewPrimitive.Tree>
    </TreeViewPrimitive.Root>
  );
};

const ChevronRightIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
    <title>Chevron Right Icon</title>
    <path
      fill="none"
      stroke="currentColor"
      stroke-linecap="round"
      stroke-linejoin="round"
      stroke-width="2"
      d="m9 18l6-6l-6-6"
    />
  </svg>
);
