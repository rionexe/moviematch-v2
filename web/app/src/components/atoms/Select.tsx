import React from "react";
import { GlassSelect } from "./GlassSelect";

interface SelectProps<Value extends string = string> {
  name: string;
  options: Record<Value, string>;
  value: Value;
  onChange?: (event: React.ChangeEvent<HTMLSelectElement>) => void;
  onBlur?: (event: React.FocusEvent<HTMLSelectElement>) => void;
}

export const Select = ({
  name,
  value = "" as any,
  options,
  onChange,
  onBlur,
}: SelectProps) => (
  <GlassSelect
    name={name}
    value={value}
    options={Object.entries(options).map(([v, label]) => ({
      value: v,
      label: label as string,
    }))}
    testHandle={`${name}-select-input`}
    onChange={(newValue) => {
      onChange?.({ target: { value: newValue } } as React.ChangeEvent<HTMLSelectElement>);
    }}
    onBlur={() => {
      onBlur?.({} as React.FocusEvent<HTMLSelectElement>);
    }}
  />
);
