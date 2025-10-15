import { memo, useEffect, useMemo, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import {
  ArrowRightOnRectangleIcon,
  BuildingOffice2Icon,
  ChevronRightIcon,
  ClipboardDocumentCheckIcon,
  ClipboardDocumentListIcon,
  DocumentPlusIcon,
  FolderOpenIcon,
  HomeIcon,
  QueueListIcon,
  UserCircleIcon,
  UsersIcon,
  WrenchScrewdriverIcon,
} from "@heroicons/react/24/outline";
import { useAuth } from "../context/AuthContext.jsx";

const DEFAULT_BRAND = { line1: "Control de Citas", line2: "y Mamografias" };

export const DEFAULT_SECTIONS = [
  {
    id: "panel",
    title: "Panel Principal",
    icon: HomeIcon,
    path: "/panel",
    exact: true,
  },
  {
    id: "pacientes",
    title: "Pacientes",
    icon: UsersIcon,
    path: "/pacientes",
    required: ["view:patients"],
  },
  {
    id: "procedimientos",
    title: "Citas",
    icon: ClipboardDocumentListIcon,
    items: [
      {
        id: "procedimientos-agendar",
        label: "Agendar cita",
        path: "/procedimientos/agendar",
        icon: DocumentPlusIcon,
        requireAny: ["create:appointments", "phase:register", "phase:read", "phase:deliver"],
      },
    ],
  },
  {
    id: "mantenimiento",
    title: "Mantenimiento",
    icon: WrenchScrewdriverIcon,
    items: [
      {
        id: "mantenimiento-centros",
        label: "Centros de atencion",
        path: "/mantenimiento/centros",
        icon: BuildingOffice2Icon,
        required: ["view:centers"],
      },
      {
        id: "mantenimiento-servicios",
        label: "Servicios",
        path: "/mantenimiento/servicios",
        icon: ClipboardDocumentCheckIcon,
        required: ["view:services"],
      },
      {
        id: "mantenimiento-contratos",
        label: "Contratos",
        path: "/mantenimiento/contratos",
        icon: FolderOpenIcon,
        required: ["view:contracts"],
      },
      {
        id: "mantenimiento-contratos-armado",
        label: "Armar contratos",
        path: "/mantenimiento/contratos/armado",
        icon: DocumentPlusIcon,
        required: ["create:contracts"],
      },
      {
        id: "mantenimiento-usuarios",
        label: "Usuarios",
        path: "/mantenimiento/usuarios",
        icon: UsersIcon,
        required: ["*"],
      },
      // {
      //   id: "mantenimiento-catalogos",
      //   label: "Catalogos",
      //   path: "/mantenimiento/catalogos",
      //   icon: QueueListIcon,
      //   required: ["*"],
      // },
    ],
  },
];

function Icon({ icon: IconComponent, className = "size-5" }) {
  if (!IconComponent) return null;
  return <IconComponent className={className} aria-hidden />;
}

const Chevron = ({ open }) => (
  <ChevronRightIcon className={`size-4 transition-transform ${open ? "rotate-90" : ""}`} aria-hidden />
);

function NavItem({ item, isChild = false, onNavigate }) {
  if (!item?.path) return null;
  const padding = isChild ? "pl-9 pr-3 py-2" : "px-3 py-2";

  return (
    <NavLink
      to={item.path}
      end={item.exact === true}
      onClick={() => onNavigate?.(item)}
      className={({ isActive }) =>
        `${padding} group flex items-center gap-3 rounded-lg text-sm transition-colors ${isActive
          ? "bg-gray-900 text-white shadow-sm"
          : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
        }`
      }
    >
      <Icon icon={item.icon} />
      <span>{item.label ?? item.title}</span>
    </NavLink>
  );
}

function sectionHasActiveChild(section, pathname) {
  if (!Array.isArray(section?.items)) return false;
  return section.items.some((item) => {
    if (!item.path) return false;
    return pathname === item.path || pathname.startsWith(`${item.path}/`);
  });
}

function buildInitialOpenState(sections, pathname) {
  return sections.reduce((acc, section) => {
    if (Array.isArray(section.items) && section.items.length) {
      const shouldOpen = Boolean(section.defaultOpen) || sectionHasActiveChild(section, pathname);
      acc[section.id] = shouldOpen;
    }
    return acc;
  }, {});
}

function Section({ section, isOpen, toggle, onNavigate }) {
  if (!Array.isArray(section.items) || section.items.length === 0) {
    return (
      <div className="px-2">
        <NavItem item={section} onNavigate={onNavigate} />
      </div>
    );
  }

  return (
    <div className="px-2">
      <button
        type="button"
        onClick={() => toggle(section.id)}
        className="w-full flex items-center justify-between rounded-lg px-3 py-2 text-left text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100"
      >
        <span className="flex items-center gap-3">
          <Icon icon={section.icon} />
          <span>{section.title}</span>
        </span>
        <Chevron open={isOpen} />
      </button>

      <div className={`mt-1 space-y-1 overflow-hidden transition-[max-height] duration-200 ${isOpen ? "max-h-60" : "max-h-0"}`}>
        {section.items.map((item) => (
          <NavItem key={item.id} item={item} isChild onNavigate={onNavigate} />
        ))}
      </div>
    </div>
  );
}

function filterSections(sections, hasAllPermissions, hasAnyPermissions) {
  return sections
    .map((section) => {
      const requiredSectionPerms = Array.isArray(section.required) ? section.required : [];
      const anySectionPerms = Array.isArray(section.requireAny) ? section.requireAny : [];
      if (requiredSectionPerms.length && !hasAllPermissions(requiredSectionPerms)) {
        return null;
      }
      if (anySectionPerms.length && !hasAnyPermissions(anySectionPerms)) {
        return null;
      }

      if (Array.isArray(section.items) && section.items.length > 0) {
        const filteredItems = section.items.filter((item) => {
          const requiredItemPerms = Array.isArray(item.required) ? item.required : [];
          const anyItemPerms = Array.isArray(item.requireAny) ? item.requireAny : [];
          const meetsRequired = requiredItemPerms.length === 0 || hasAllPermissions(requiredItemPerms);
          const meetsAny = anyItemPerms.length === 0 || hasAnyPermissions(anyItemPerms);
          return meetsRequired && meetsAny;
        });
        if (filteredItems.length === 0) {
          return null;
        }
        return { ...section, items: filteredItems };
      }

      return section;
    })
    .filter(Boolean);
}

function SidebarComponent({
  brand = DEFAULT_BRAND,
  sections = DEFAULT_SECTIONS,
  onNavigate,
  onLogout,
  logoutDisabled = false,
}) {
  const location = useLocation();
  const { hasAllPermissions, hasAnyPermissions } = useAuth();
  const filteredSections = useMemo(
    () => filterSections(sections, hasAllPermissions, hasAnyPermissions),
    [sections, hasAllPermissions, hasAnyPermissions],
  );
  const [open, setOpen] = useState(() => buildInitialOpenState(filteredSections, location.pathname));

  useEffect(() => {
    setOpen((prev) => {
      const next = { ...prev };
      filteredSections.forEach((section) => {
        if (!Array.isArray(section.items) || section.items.length === 0) return;
        if (!(section.id in next)) {
          next[section.id] = Boolean(section.defaultOpen);
        }
        if (sectionHasActiveChild(section, location.pathname)) {
          next[section.id] = true;
        }
      });
      return next;
    });
  }, [filteredSections, location.pathname]);

  const toggle = (id) => setOpen((prev) => ({ ...prev, [id]: !prev[id] }));

  return (
    <aside className="flex h-full w-64 flex-col border-r border-gray-100 bg-white">
      <div className="p-5 text-xl font-extrabold leading-5 text-gray-900">
        <div>{brand?.line1 ?? DEFAULT_BRAND.line1}</div>
        <div>{brand?.line2 ?? DEFAULT_BRAND.line2}</div>
      </div>

      <nav className="flex-1 space-y-2 overflow-y-auto pb-6">
        {filteredSections.map((section) => (
          <Section
            key={section.id}
            section={section}
            isOpen={Boolean(open[section.id])}
            toggle={toggle}
            onNavigate={onNavigate}
          />
        ))}
      </nav>

      <div className="mt-auto space-y-4 border-t border-gray-100 p-5">
        <div className="flex justify-center">
          <UserCircleIcon className="size-16 text-gray-300" aria-hidden />
        </div>
        {onLogout ? (
          <button
            type="button"
            onClick={onLogout}
            disabled={logoutDisabled}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gray-900 px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <ArrowRightOnRectangleIcon className="size-4" aria-hidden />
            {logoutDisabled ? "Cerrando..." : "Cerrar sesion"}
          </button>
        ) : null}
      </div>
    </aside>
  );
}

export default memo(SidebarComponent);
