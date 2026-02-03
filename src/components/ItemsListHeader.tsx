import {
  Button,
  Text,
  Box,
  FileUpload,
  HStack,
  Input,
  Menu,
  VStack,
} from "@chakra-ui/react";
import TescoDataHelp from "./TescoDataHelp";

type ItemsListHeaderProps = {
  hasItems: boolean;
  isBusy: boolean;
  totalSpentDisplay: string | null;
  onFileAccept: (details: { files: File[] }) => void;
  onClearDatabase: () => void;
  showSelectionControls: boolean;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  onCombineClick: () => void;
  combineDisabled: boolean;
  selectAllDisabled: boolean;
  deselectAllDisabled: boolean;
  editingCombinedId: number | null;
  editingCombinedName: string;
  onEditingCombinedNameChange: (value: string) => void;
  onSaveCombinedEdit: () => void;
  onCancelCombinedEdit: () => void;
};

export default function ItemsListHeader({
  hasItems,
  isBusy,
  totalSpentDisplay,
  onFileAccept,
  onClearDatabase,
  showSelectionControls,
  onSelectAll,
  onDeselectAll,
  onCombineClick,
  combineDisabled,
  selectAllDisabled,
  deselectAllDisabled,
  editingCombinedId,
  editingCombinedName,
  onEditingCombinedNameChange,
  onSaveCombinedEdit,
  onCancelCombinedEdit,
}: ItemsListHeaderProps) {
  const isEditingCombined = editingCombinedId !== null;
  return (
    <>
      {!hasItems && (
        <Text fontSize="xl" fontWeight="bold">
          Import Purchase Data
        </Text>
      )}
      <HStack gap={3} width="100%" >
        <FileUpload.Root
          accept={{
            "application/json": [".json"],
            "application/vnd.ms-excel": [".xls"],
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [
              ".xlsx",
            ],
          }}
          onFileAccept={onFileAccept}
        >
          <FileUpload.HiddenInput />
          {hasItems ? (
            <HStack justify='space-between' width="100%">
              {totalSpentDisplay && (
                <Box
                  p={4}
                  bg="blue.50"
                  borderRadius="md"
                  borderWidth="1px"
                  borderColor="blue.200"
                >
                  <Text fontSize="lg" fontWeight="bold" color="blue.900">
                    Total Spent: £{totalSpentDisplay}
                  </Text>
                </Box>
              )}
            <Menu.Root>
              <Menu.Trigger asChild>
                <Button borderColor="fg.inverted">Menu</Button>
              </Menu.Trigger>
              <Menu.Positioner>
                <Menu.Content>
                  <FileUpload.Trigger asChild>
                    <Menu.Item value="select-file">
                      Select File (JSON/XLSX)
                    </Menu.Item>
                  </FileUpload.Trigger>
                  <Menu.Item
                    value="clear-database"
                    onClick={onClearDatabase}
                    disabled={isBusy}
                  >
                    Clear Database
                  </Menu.Item>
                </Menu.Content>
              </Menu.Positioner>
            </Menu.Root>
            </HStack>
          ) : (
            <VStack width="100%" justify="center" alignItems="center" gap={4}>
              <FileUpload.Trigger asChild>
                <Button
                  color="fg.muted"
                  borderColor="fg.default"
                  variant="outline"
                >
                  Select Tesco purchase history JSON File
                </Button>
              </FileUpload.Trigger>
              <TescoDataHelp />
            </VStack>
          )}
        </FileUpload.Root>
      </HStack>
      {showSelectionControls && (
        <VStack align="start" gap={2}>
          <HStack gap={2}>
            <Button
              size="sm"
              variant="outline"
              onClick={onSelectAll}
              disabled={selectAllDisabled}
            >
              Select all
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={onDeselectAll}
              disabled={deselectAllDisabled}
            >
              Deselect all
            </Button>
            {isEditingCombined ? (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={onSaveCombinedEdit}
                  disabled={!editingCombinedName.trim() || combineDisabled}
                >
                  Save
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={onCancelCombinedEdit}
                >
                  Cancel
                </Button>
              </>
            ) : (
              <Button
                size="sm"
                variant="outline"
                onClick={onCombineClick}
                disabled={combineDisabled}
              >
                Combine
              </Button>
            )}
          </HStack>
          {isEditingCombined && (
            <Input
              size="sm"
              placeholder="Combined item name"
              value={editingCombinedName}
              onChange={(event) =>
                onEditingCombinedNameChange(event.target.value)
              }
              width="240px"
            />
          )}
        </VStack>
      )}
      
    </>
  );
}
