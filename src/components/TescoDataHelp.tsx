import { Box, Checkbox, Input, Link, Text, VStack } from "@chakra-ui/react";
import { useEffect, useState } from "react";
import { withMask } from "use-mask-input";

function TescoWord() {
  return (
    <Text
      as="span"
      bg="blue.300"
      color="red.500"
      px={1}
      borderRadius="sm"
      fontWeight="semibold"
    >
      Tesco
    </Text>
  );
}

function HelpLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      color="white"
      bg="blue.600"
      px={2}
      py={1}
      borderRadius="md"
      target="_blank"
      rel="noopener noreferrer"
    >
      {children}
    </Link>
  );
}

const withMaskValue = (value: string) =>
  value.replace(/[^a-z0-9]/gi, "").slice(0, 6).toUpperCase();

export default function TescoDataHelp() {
  const [requestNote, setRequestNote] = useState("");

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const stored = window.localStorage.getItem("tescoRequestNote");
    if (stored) {
      const sanitized = withMaskValue(stored);
      setRequestNote(sanitized);
      if (sanitized !== stored) {
        window.localStorage.setItem("tescoRequestNote", sanitized);
      }
    }
  }, []);

  const handleRequestNoteChange = (value: string) => {
    const sanitized = withMaskValue(value);
    setRequestNote(sanitized);
    if (typeof window !== "undefined") {
      window.localStorage.setItem("tescoRequestNote", sanitized);
    }
  };

  return (
    <Box
      maxW="640px"
      width="100%"
      borderWidth="1px"
      borderColor="gray.200"
      borderRadius="md"
      p={4}
      bg="gray.50"
    >
      <VStack align="start" gap={2}>
        <Text fontWeight="semibold">
          Need help downloading your <TescoWord /> purchase history?
        </Text>
        
        <Text color="fg.muted">
          <HelpLink href="https://www.tesco.com/account/data-portability/en-GB/requests/new?success=true">
            Start a new request
          </HelpLink>
          {` `}and make sure to select{` `}
          <Checkbox.Root checked={true}>
            <Checkbox.Control>
              <Checkbox.Indicator />
            </Checkbox.Control>
          </Checkbox.Root>
          {` `}"Purchase data"
        </Text>
        <Text color="fg.muted">
          You will be given a verification code. You'll need to enter your verification code to access your data.
          You can save your code here so you can find it later:
        </Text>
        <Input
          value={requestNote}
          onChange={(event) => handleRequestNoteChange(event.target.value)}
          placeholder="6-character unlock code"
          maxLength={6}
          autoComplete="off"
          inputMode="text"
          ref={withMask("******")}
        />
        <Text color="fg.muted">
          You will later receive an email notifying you that the file is ready to download. You can downlaod it from your{` `}
          <Link href="https://www.tesco.com/account/data-portability/en-GB/requests">
            requests page
          </Link>

        </Text>
        <Text color="fg.muted">
          Once the file is ready, download the JSON and upload it above
        </Text>
      </VStack>
    </Box>
  );
}
