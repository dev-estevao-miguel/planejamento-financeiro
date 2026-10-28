"use client";

import { ClipboardCopy, Download } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, Textarea } from "@/components/ui/field";
import { buildAiPrompt, DEFAULT_AI_EXPORT_OPTIONS, type AiExportData, type AiExportOptions } from "./build-prompt";

const TOGGLES: { key: Exclude<keyof AiExportOptions, "question">; label: string; hint: string }[] = [
  { key: "includeNames", label: "Nomes", hint: "Sem isso, aparecem como “Pessoa 1”, “Pessoa 2”." },
  { key: "includeIndividual", label: "Renda e gastos por pessoa", hint: "Salários e despesas atribuídas a cada um." },
  { key: "includeCategories", label: "Despesas por categoria", hint: "Para onde o dinheiro foi." },
  { key: "includeBudgets", label: "Planejado × realizado", hint: "Orçamento do último mês do período." },
  { key: "includeInvestments", label: "Investimentos", hint: "Aportes feitos no período." },
];

/** Pick what goes in, read the whole text, then copy or download. Nothing is sent anywhere. */
export function AiExportBuilder({ data, fileName }: { data: AiExportData; fileName: string }) {
  const [options, setOptions] = useState<AiExportOptions>(DEFAULT_AI_EXPORT_OPTIONS);
  const text = useMemo(() => buildAiPrompt(data, options), [data, options]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Texto copiado. Cole no assistente de IA de sua preferência.");
    } catch {
      toast.error("Não foi possível copiar. Selecione o texto e copie manualmente.");
    }
  }

  function download() {
    const url = URL.createObjectURL(new Blob([text], { type: "text/plain;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)]">
      <div className="flex flex-col gap-5">
        <fieldset className="flex flex-col gap-3">
          <legend className="mb-2 text-sm font-medium">O que incluir</legend>
          {TOGGLES.map((toggle) => (
            <label key={toggle.key} className="flex items-start gap-3 text-sm">
              <input
                type="checkbox"
                checked={options[toggle.key]}
                onChange={(event) => setOptions((current) => ({ ...current, [toggle.key]: event.target.checked }))}
                className="mt-0.5 size-5 accent-[var(--primary)]"
              />
              <span>
                {toggle.label}
                <span className="block text-muted-foreground">{toggle.hint}</span>
              </span>
            </label>
          ))}
        </fieldset>
        <Field id="question" label="Sua pergunta (opcional)" hint="Ex.: Como montar uma reserva de emergência em 1 ano?">
          {(describedBy) => (
            <Textarea
              id="question"
              maxLength={1000}
              rows={3}
              value={options.question}
              onChange={(event) => setOptions((current) => ({ ...current, question: event.target.value }))}
              aria-describedby={describedBy}
            />
          )}
        </Field>
        <p className="text-xs text-muted-foreground">
          Nunca entram e-mails, telefones, identificadores internos ou senhas. Revise o texto antes de compartilhar.
        </p>
      </div>

      <div className="flex min-w-0 flex-col gap-3">
        <label htmlFor="ai-preview" className="text-sm font-medium">
          Pré-visualização
        </label>
        <Textarea id="ai-preview" readOnly value={text} rows={18} className="font-mono text-xs leading-relaxed" />
        <div className="flex flex-wrap gap-3">
          <Button onClick={copy}>
            <ClipboardCopy className="size-4" aria-hidden /> Copiar texto
          </Button>
          <Button variant="secondary" onClick={download}>
            <Download className="size-4" aria-hidden /> Baixar .txt
          </Button>
        </div>
      </div>
    </div>
  );
}
