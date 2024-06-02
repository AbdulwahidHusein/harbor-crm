import React from "react";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "../ui/button";

type RightSheetProps = {
  open?: boolean;
  setOpen?: (open: boolean) => void;
  position?: "left" | "right" | "top" | "bottom";
  trigger?: string;
  title: string;
  description: string;
  children: React.ReactNode;
  onClose: React.RefObject<HTMLButtonElement> | null;
};

const FormSheet = ({
  open,
  setOpen,
  position,
  trigger,
  title,
  description,
  children,
  onClose,
}: RightSheetProps) => {
  console.log(open, "open");
  return (
    <Sheet>
      <SheetTrigger asChild ref={onClose}>
        <Button className="mb-5">{trigger}</Button>
      </SheetTrigger>
      <SheetContent side={position || "right"}>
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
          <SheetDescription>{description}</SheetDescription>
        </SheetHeader>
        {children}
      </SheetContent>
    </Sheet>
  );
};

export default FormSheet;
