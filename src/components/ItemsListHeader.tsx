import { Button, Text, Box, FileUpload, HStack, Menu } from "@chakra-ui/react";

type ItemsListHeaderProps = {
  hasItems: boolean;
  isBusy: boolean;
  totalSpentDisplay: string | null;
  onFileAccept: (details: { files: File[] }) => void;
  onClearDatabase: () => void;
};

export default function ItemsListHeader({
  hasItems,
  isBusy,
  totalSpentDisplay,
  onFileAccept,
  onClearDatabase,
}: ItemsListHeaderProps) {
  return (
    <>
      <Text fontSize="xl" fontWeight="bold">
        Import Purchase Data
      </Text>
      <HStack gap={3}>
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
            <Menu.Root>
              <Menu.Trigger asChild>
                <Button colorPalette="black">Menu</Button>
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
          ) : (
            <FileUpload.Trigger asChild>
              <Button
                color="fg.muted"
                borderColor="fg.default"
                variant="outline"
              >
                Select File (JSON/XLSX)
              </Button>
            </FileUpload.Trigger>
          )}
        </FileUpload.Root>
      </HStack>
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
    </>
  );
}
