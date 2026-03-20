"use client"

import * as React from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { X } from "lucide-react"
import { format, parse } from "date-fns"
import { ptBR } from "date-fns/locale"

interface DatePickerInputProps {
  id?: string
  value?: Date
  onChange: (date: Date | undefined) => void
  placeholder?: string
  className?: string
  disabled?: boolean
  showTime?: boolean
}

export function DatePickerInput({
  id,
  value,
  onChange,
  placeholder = "Selecione uma data",
  className,
  disabled = false,
  showTime = true,
}: DatePickerInputProps) {
  const [dateStr, setDateStr] = React.useState<string>(
    value ? format(value, "yyyy-MM-dd") : ""
  )
  const [timeStr, setTimeStr] = React.useState<string>(
    value ? format(value, "HH:mm") : "00:00"
  )

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newDateStr = e.target.value
    setDateStr(newDateStr)

    if (!newDateStr) {
      onChange(undefined)
      return
    }

    try {
      const [year, month, day] = newDateStr.split("-")
      const datePart = new Date(parseInt(year), parseInt(month) - 1, parseInt(day))

      if (showTime && timeStr) {
        const [hours, minutes] = timeStr.split(":")
        datePart.setHours(parseInt(hours) || 0, parseInt(minutes) || 0, 0, 0)
      }

      onChange(datePart)
    } catch (error) {
      console.error("Erro ao processar data:", error)
    }
  }

  const handleTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTimeStr = e.target.value
    setTimeStr(newTimeStr)

    if (!dateStr || !newTimeStr) return

    try {
      const [year, month, day] = dateStr.split("-")
      const datePart = new Date(parseInt(year), parseInt(month) - 1, parseInt(day))

      if (newTimeStr) {
        const [hours, minutes] = newTimeStr.split(":")
        datePart.setHours(parseInt(hours) || 0, parseInt(minutes) || 0, 0, 0)
      }

      onChange(datePart)
    } catch (error) {
      console.error("Erro ao processar hora:", error)
    }
  }

  const handleClear = () => {
    setDateStr("")
    setTimeStr("00:00")
    onChange(undefined)
  }

  const displayValue = value ? format(value, "dd/MM/yyyy HH:mm", { locale: ptBR }) : ""

  return (
    <div className={className}>
      <div className="space-y-3">
        {/* Display Field */}
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <Input
              id={id}
              type="text"
              value={displayValue}
              placeholder={placeholder}
              readOnly
              disabled={disabled}
              className="cursor-default bg-muted"
            />
            {value && (
              <button
                onClick={handleClear}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                type="button"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        {/* Input Fields */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor={`${id}-date`} className="text-xs font-medium">
              Data
            </Label>
            <Input
              id={`${id}-date`}
              type="date"
              value={dateStr}
              onChange={handleDateChange}
              disabled={disabled}
              className="text-sm"
            />
          </div>

          {showTime && (
            <div className="space-y-2">
              <Label htmlFor={`${id}-time`} className="text-xs font-medium">
                Hora
              </Label>
              <Input
                id={`${id}-time`}
                type="time"
                value={timeStr}
                onChange={handleTimeChange}
                disabled={disabled}
                className="text-sm"
              />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
