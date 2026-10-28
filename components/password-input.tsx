"use client";

import { EyeIcon, EyeOffIcon } from "lucide-react";
import { useState, type ComponentProps } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type PasswordInputProps = Omit<ComponentProps<typeof Input>, "type"> & {
  show_label: string;
  hide_label: string;
};

export function PasswordInput({ show_label, hide_label, className, ...props }: PasswordInputProps) {
  const [is_visible, setIsVisible] = useState(false);

  return (
    <div className="relative">
      <Input type={is_visible ? "text" : "password"} className={cn("pr-10", className)} {...props} />
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        className="text-muted-foreground absolute top-1/2 right-1 -translate-y-1/2"
        aria-label={is_visible ? hide_label : show_label}
        aria-pressed={is_visible}
        onClick={() => setIsVisible((value) => !value)}
      >
        {is_visible ? <EyeOffIcon /> : <EyeIcon />}
      </Button>
    </div>
  );
}
