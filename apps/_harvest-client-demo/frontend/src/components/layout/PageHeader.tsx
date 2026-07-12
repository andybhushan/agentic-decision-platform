import type { ReactNode } from 'react';
import { Button } from '@carbon/react';
import { ArrowLeft } from '@carbon/icons-react';
import './PageHeader.scss';

export interface PageHeaderBack {
  label: string;
  onClick: () => void;
}

export interface PageHeaderProps {
  /** Main page title. */
  title: ReactNode;
  /** Optional supporting line rendered below the title. */
  subtitle?: ReactNode;
  /** Optional small line (breadcrumb / context) rendered above the title. */
  eyebrow?: ReactNode;
  /** Optional icon rendered to the left of the title. */
  icon?: ReactNode;
  /** Optional tag row rendered below the title. */
  tags?: ReactNode;
  /** Optional right-aligned actions (buttons) on the title row. */
  actions?: ReactNode;
  /** Optional back affordance rendered above everything else. */
  back?: PageHeaderBack;
  /** Optional extra class for page-specific tweaks. */
  className?: string;
}

/**
 * Shared page header used across all primary pages so the title block and the
 * gap between the header and the page content are identical everywhere.
 */
const PageHeader = ({
  title,
  subtitle,
  eyebrow,
  icon,
  tags,
  actions,
  back,
  className,
}: PageHeaderProps) => {
  return (
    <header className={`app-page-header${className ? ` ${className}` : ''}`}>
      {back && (
        <Button
          kind="ghost"
          size="sm"
          className="app-page-header__back"
          renderIcon={ArrowLeft}
          onClick={back.onClick}
        >
          {back.label}
        </Button>
      )}

      {eyebrow && <div className="app-page-header__eyebrow">{eyebrow}</div>}

      <div className="app-page-header__bar">
        <div className="app-page-header__heading">
          {icon && <span className="app-page-header__icon">{icon}</span>}
          <h1 className="app-page-header__title">{title}</h1>
        </div>
        {actions && <div className="app-page-header__actions">{actions}</div>}
      </div>

      {tags && <div className="app-page-header__tags">{tags}</div>}

      {subtitle && <p className="app-page-header__subtitle">{subtitle}</p>}
    </header>
  );
};

export default PageHeader;
