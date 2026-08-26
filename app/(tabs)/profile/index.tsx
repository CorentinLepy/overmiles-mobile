import { SectionPlaceholderScreen } from "@/src/features/app-shell/screens/section-placeholder-screen";

export default function ProfileRoute() {
  return (
    <SectionPlaceholderScreen
      eyebrow="PROFIL"
      title="Votre compte, vos préférences, vos appareils."
      description="Cette section regroupera votre profil, la sécurité du compte, les sessions connectées, la biométrie locale et les préférences de l’application."
      status="COR-135 / COR-58 — À CONNECTER"
    />
  );
}
