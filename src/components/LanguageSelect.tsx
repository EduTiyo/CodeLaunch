import { useTranslation } from "react-i18next";
import { Globe } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { setAppLanguage, type SupportedLanguage } from "@/i18n";

export function LanguageSelect() {
  const { i18n, t } = useTranslation();
  const normalized = i18n.language?.toLowerCase() ?? "en-us";
  const currentLang: SupportedLanguage = normalized.startsWith("pt") ? "pt-br" : "en-us";

  return (
    <Select
      value={currentLang}
      onValueChange={(val) => setAppLanguage(val as SupportedLanguage)}
    >
      <SelectTrigger
        size="sm"
        className="h-8 gap-1.5 px-2.5 text-xs font-normal"
        aria-label={t("common.selectLanguage")}
      >
        <Globe className="size-3.5 text-muted-foreground" />
        <SelectValue />
      </SelectTrigger>
      <SelectContent align="end">
        <SelectItem value="en-us">{t("languages.en-us")}</SelectItem>
        <SelectItem value="pt-br">{t("languages.pt-br")}</SelectItem>
      </SelectContent>
    </Select>
  );
}
