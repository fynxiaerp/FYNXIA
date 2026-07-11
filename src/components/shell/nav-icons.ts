// nav-icons.ts — maps serializable NavIconKey strings to Lucide components.
// Imported ONLY by Client Components (SidebarNavClient, MobileMenuTrigger) so the
// icon components stay on the client and never cross the RSC server→client boundary.
import {
  Calendar,
  Users,
  DollarSign,
  FileText,
  UserCog,
  BrainCircuit,
  FlaskConical,
  Stethoscope,
  Armchair,
  FileHeart,
  Video,
  ShieldCheck,
  Boxes,
  Package,
  type LucideIcon,
} from 'lucide-react'
import type { NavIconKey } from './nav-config'

export const NAV_ICONS: Record<NavIconKey, LucideIcon> = {
  agenda: Calendar,
  pacientes: Users,
  financeiro: DollarSign,
  documentos: FileText,
  equipe: UserCog,
  profissionais: Stethoscope,
  recursos: Armchair,
  ia: BrainCircuit,
  prototipos: FlaskConical,
  receituario: FileHeart,
  teleodontologia: Video,
  esterilizacao: ShieldCheck,
  protese: Boxes,
  estoque: Package,
}
