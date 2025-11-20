import {
  JSX,
  Component,
  createSignal,
  createMemo,
  splitProps,
} from "solid-js";
import { Accordion } from "@kobalte/core/accordion";
import { ChevronRight } from "lucide-solid";
import { cva } from "class-variance-authority";
import { cn } from "@/libs/cn";

const treeVariants = cva(
  "group hover:before:opacity-100 before:absolute before:rounded-lg before:left-0 px-2 before:w-full before:opacity-0 before:bg-accent/70 before:h-[2rem] before:-z-10",
);

const selectedTreeVariants = cva(
  "before:opacity-100 before:bg-accent/70 text-accent-foreground",
);

const dragOverVariants = cva(
  "before:opacity-100 before:bg-primary/20 text-primary-foreground",
);

export interface TreeDataItem {
  id: string;
  name: string;
  icon?: any;
  selectedIcon?: any;
  openIcon?: any;
  children?: TreeDataItem[];
  actions?: JSX.Element;
  onClick?: () => void;
  draggable?: boolean;
  droppable?: boolean;
  disabled?: boolean;
}

export type TreeProps =
  JSX.HTMLAttributes<HTMLDivElement> & {
    data: TreeDataItem[] | TreeDataItem;
    initialSelectedItemId?: string;
    onSelectChange?: (
      item: TreeDataItem | undefined,
    ) => void;
    expandAll?: boolean;
    defaultNodeIcon?: any;
    defaultLeafIcon?: any;
    onDocumentDrag?: (
      sourceItem: TreeDataItem,
      targetItem: TreeDataItem,
    ) => void;
  };

export const TreeView: Component<TreeProps> = (props) => {
  const [local, rest] = splitProps(props, [
    "data",
    "initialSelectedItemId",
    "onSelectChange",
    "expandAll",
    "defaultLeafIcon",
    "defaultNodeIcon",
    "onDocumentDrag",
    "class",
  ]);

  const [selectedItemId, setSelectedItemId] = createSignal<
    string | undefined
  >(local.initialSelectedItemId);
  const [draggedItem, setDraggedItem] =
    createSignal<TreeDataItem | null>(null);

  const handleSelectChange = (
    item: TreeDataItem | undefined,
  ) => {
    setSelectedItemId(item?.id);
    local.onSelectChange?.(item);
  };

  const handleDragStart = (item: TreeDataItem) => {
    setDraggedItem(item);
  };

  const handleDrop = (targetItem: TreeDataItem) => {
    const source = draggedItem();
    if (
      source &&
      local.onDocumentDrag &&
      source.id !== targetItem.id
    ) {
      local.onDocumentDrag(source, targetItem);
    }
    setDraggedItem(null);
  };

  const expandedItemIds = createMemo(() => {
    const data = local.data;
    const expandAll = local.expandAll;
    const initialSelectedItemId =
      local.initialSelectedItemId;

    const ids: string[] = [];

    // 收集整棵树所有节点 id
    function collectAll(
      items: TreeDataItem[] | TreeDataItem,
    ) {
      if (Array.isArray(items)) {
        for (const it of items) {
          ids.push(it.id);
          if (it.children) collectAll(it.children);
        }
      } else {
        ids.push(items.id);
        if (items.children) collectAll(items.children);
      }
    }

    // 只收集到某个目标节点为止（和原来的逻辑一致）
    function collectPath(
      items: TreeDataItem[] | TreeDataItem,
      targetId: string,
    ): boolean | void {
      if (Array.isArray(items)) {
        for (let i = 0; i < items.length; i++) {
          ids.push(items[i]!.id);
          if (collectPath(items[i]!, targetId)) {
            return true;
          }
          ids.pop();
        }
      } else if (items.id === targetId) {
        return true;
      } else if (items.children) {
        return collectPath(items.children, targetId);
      }
    }

    // 情况 1：展开全部，直接遍历整棵树
    if (expandAll) {
      collectAll(data);
      return ids;
    }

    // 情况 2：只按 initialSelectedItemId 展开路径
    if (!initialSelectedItemId) {
      return [];
    }

    collectPath(data, initialSelectedItemId);
    return ids;
  });

  return (
    <div
      {...rest}
      class={cn(
        "relative overflow-hidden p-2",
        local.class,
      )}
    >
      <TreeItem
        data={local.data}
        selectedItemId={selectedItemId()}
        handleSelectChange={handleSelectChange}
        expandedItemIds={expandedItemIds()}
        defaultLeafIcon={local.defaultLeafIcon}
        defaultNodeIcon={local.defaultNodeIcon}
        handleDragStart={handleDragStart}
        handleDrop={handleDrop}
        draggedItem={draggedItem()}
      />

      {/* 底部 drop 区 */}
      <div
        class="h-[48px] w-full"
        onDrop={(e) => {
          e.preventDefault();
          handleDrop({ id: "", name: "parent_div" });
        }}
        onDragOver={(e) => {
          if (draggedItem()) e.preventDefault();
        }}
      />
    </div>
  );
};

type TreeItemProps = TreeProps & {
  selectedItemId?: string;
  handleSelectChange: (
    item: TreeDataItem | undefined,
  ) => void;
  expandedItemIds: string[];
  defaultNodeIcon?: any;
  defaultLeafIcon?: any;
  handleDragStart?: (item: TreeDataItem) => void;
  handleDrop?: (item: TreeDataItem) => void;
  draggedItem: TreeDataItem | null;
};

const TreeItem: Component<TreeItemProps> = (props) => {
  const [local, rest] = splitProps(props, [
    "data",
    "selectedItemId",
    "handleSelectChange",
    "expandedItemIds",
    "defaultNodeIcon",
    "defaultLeafIcon",
    "handleDragStart",
    "handleDrop",
    "draggedItem",
    "class",
  ]);

  const dataArray = createMemo(() =>
    Array.isArray(local.data) ? local.data : [local.data],
  );

  return (
    <div role="tree" class={local.class} {...rest}>
      <ul>
        {dataArray().map((item) => (
          <li id={item.id}>
            {item.children ? (
              <TreeNode
                item={item}
                selectedItemId={local.selectedItemId}
                expandedItemIds={local.expandedItemIds}
                handleSelectChange={
                  local.handleSelectChange
                }
                defaultNodeIcon={local.defaultNodeIcon}
                defaultLeafIcon={local.defaultLeafIcon}
                handleDragStart={local.handleDragStart}
                handleDrop={local.handleDrop}
                draggedItem={local.draggedItem}
              />
            ) : (
              <TreeLeaf
                item={item}
                selectedItemId={local.selectedItemId}
                handleSelectChange={
                  local.handleSelectChange
                }
                defaultLeafIcon={local.defaultLeafIcon}
                handleDragStart={local.handleDragStart}
                handleDrop={local.handleDrop}
                draggedItem={local.draggedItem}
              />
            )}
          </li>
        ))}
      </ul>
    </div>
  );
};

const TreeNode: Component<{
  item: TreeDataItem;
  handleSelectChange: (
    item: TreeDataItem | undefined,
  ) => void;
  expandedItemIds: string[];
  selectedItemId?: string;
  defaultNodeIcon?: any;
  defaultLeafIcon?: any;
  handleDragStart?: (item: TreeDataItem) => void;
  handleDrop?: (item: TreeDataItem) => void;
  draggedItem: TreeDataItem | null;
}> = (props) => {
  const [value, setValue] = createSignal<string[]>(
    props.expandedItemIds.includes(props.item.id)
      ? [props.item.id]
      : [],
  );
  const [isDragOver, setIsDragOver] = createSignal(false);

  const isOpen = () => value().includes(props.item.id);
  const isSelected = () =>
    props.selectedItemId === props.item.id;

  const onDragStart: JSX.EventHandlerUnion<
    HTMLButtonElement,
    DragEvent
  > = (e) => {
    if (!props.item.draggable) {
      e.preventDefault();
      return;
    }
    e.dataTransfer?.setData("text/plain", props.item.id);
    props.handleDragStart?.(props.item);
  };

  const onDragOver: JSX.EventHandlerUnion<
    HTMLButtonElement,
    DragEvent
  > = (e) => {
    if (
      props.item.droppable !== false &&
      props.draggedItem &&
      props.draggedItem.id !== props.item.id
    ) {
      e.preventDefault();
      setIsDragOver(true);
    }
  };

  const onDragLeave = () => {
    setIsDragOver(false);
  };

  const onDrop: JSX.EventHandlerUnion<
    HTMLButtonElement,
    DragEvent
  > = (e) => {
    e.preventDefault();
    setIsDragOver(false);
    props.handleDrop?.(props.item);
  };

  return (
    <Accordion multiple value={value()} onChange={setValue}>
      <Accordion.Item value={props.item.id}>
        <Accordion.Header>
          <Accordion.Trigger
            class={cn(
              "relative flex w-full flex-1 cursor-pointer items-center py-2 transition-all",
              treeVariants(),
              isSelected() && selectedTreeVariants(),
              isDragOver() && dragOverVariants(),
            )}
            onClick={() => {
              props.handleSelectChange(props.item);
              props.item.onClick?.();
            }}
            draggable={!!props.item.draggable}
            onDragStart={onDragStart}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
          >
            <ChevronRight
              class={cn(
                "mr-1 h-4 w-4 shrink-0 text-accent-foreground/50 transition-transform duration-200",
                isOpen() && "rotate-90",
              )}
            />
            <TreeIcon
              item={props.item}
              isSelected={isSelected()}
              isOpen={isOpen()}
              default={props.defaultNodeIcon}
            />
            <span class="truncate text-sm">
              {props.item.name}
            </span>
            <TreeActions isSelected={isSelected()}>
              {props.item.actions}
            </TreeActions>
          </Accordion.Trigger>
        </Accordion.Header>
        <Accordion.Content
          class={cn(
            "overflow-hidden text-sm transition-all",
            "ml-4 border-l pl-1",
          )}
        >
          <div class="pt-0 pb-1">
            <TreeItem
              data={
                props.item.children
                  ? props.item.children
                  : props.item
              }
              selectedItemId={props.selectedItemId}
              handleSelectChange={props.handleSelectChange}
              expandedItemIds={props.expandedItemIds}
              defaultLeafIcon={props.defaultLeafIcon}
              defaultNodeIcon={props.defaultNodeIcon}
              handleDragStart={props.handleDragStart}
              handleDrop={props.handleDrop}
              draggedItem={props.draggedItem}
            />
          </div>
        </Accordion.Content>
      </Accordion.Item>
    </Accordion>
  );
};

const TreeLeaf: Component<
  JSX.HTMLAttributes<HTMLDivElement> & {
    item: TreeDataItem;
    selectedItemId?: string;
    handleSelectChange: (
      item: TreeDataItem | undefined,
    ) => void;
    defaultLeafIcon?: any;
    handleDragStart?: (item: TreeDataItem) => void;
    handleDrop?: (item: TreeDataItem) => void;
    draggedItem: TreeDataItem | null;
  }
> = (props) => {
  const [local, rest] = splitProps(props, [
    "item",
    "selectedItemId",
    "handleSelectChange",
    "defaultLeafIcon",
    "handleDragStart",
    "handleDrop",
    "draggedItem",
    "class",
  ]);

  const [isDragOver, setIsDragOver] = createSignal(false);
  const isSelected = () =>
    local.selectedItemId === local.item.id;

  const onDragStart: JSX.EventHandlerUnion<
    HTMLDivElement,
    DragEvent
  > = (e) => {
    if (!local.item.draggable || local.item.disabled) {
      e.preventDefault();
      return;
    }
    e.dataTransfer?.setData("text/plain", local.item.id);
    local.handleDragStart?.(local.item);
  };

  const onDragOver: JSX.EventHandlerUnion<
    HTMLDivElement,
    DragEvent
  > = (e) => {
    if (
      local.item.droppable !== false &&
      !local.item.disabled &&
      local.draggedItem &&
      local.draggedItem.id !== local.item.id
    ) {
      e.preventDefault();
      setIsDragOver(true);
    }
  };

  const onDragLeave = () => setIsDragOver(false);

  const onDrop: JSX.EventHandlerUnion<
    HTMLDivElement,
    DragEvent
  > = (e) => {
    if (local.item.disabled) return;
    e.preventDefault();
    setIsDragOver(false);
    local.handleDrop?.(local.item);
  };

  return (
    <div
      {...rest}
      class={cn(
        "relative ml-5 flex cursor-pointer items-center py-2 text-left before:right-1",
        treeVariants(),
        isSelected() && selectedTreeVariants(),
        isDragOver() && dragOverVariants(),
        local.item.disabled &&
          "pointer-events-none cursor-not-allowed opacity-50",
        local.class,
      )}
      onClick={() => {
        if (local.item.disabled) return;
        local.handleSelectChange(local.item);
        local.item.onClick?.();
      }}
      draggable={
        !!local.item.draggable && !local.item.disabled
      }
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      <TreeIcon
        item={local.item}
        isSelected={isSelected()}
        default={local.defaultLeafIcon}
      />
      <span class="grow truncate text-sm">
        {local.item.name}
      </span>
      <TreeActions
        isSelected={isSelected() && !local.item.disabled}
      >
        {local.item.actions}
      </TreeActions>
    </div>
  );
};

const TreeIcon: Component<{
  item: TreeDataItem;
  isOpen?: boolean;
  isSelected?: boolean;
  default?: any;
}> = (props) => {
  let Icon = props.default;
  if (props.isSelected && props.item.selectedIcon) {
    Icon = props.item.selectedIcon;
  } else if (props.isOpen && props.item.openIcon) {
    Icon = props.item.openIcon;
  } else if (props.item.icon) {
    Icon = props.item.icon;
  }

  return Icon ? (
    <Icon class="mr-2 h-4 w-4 shrink-0" />
  ) : null;
};

const TreeActions: Component<{
  children: JSX.Element;
  isSelected: boolean;
}> = (props) => {
  return (
    <div
      class={cn(
        props.isSelected ? "block" : "hidden",
        "absolute right-3 group-hover:block",
      )}
    >
      {props.children}
    </div>
  );
};
