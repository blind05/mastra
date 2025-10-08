import {
  AgentIcon,
  AppSidebar,
  WorkflowIcon,
  McpServerIcon,
  ToolsIcon,
  type AppSidebarSection,
  GithubIcon,
} from '@mastra/playground-ui';
import {
  BookIcon,
  CloudUploadIcon,
  EarthIcon,
  EyeIcon,
  GaugeIcon,
  GlobeIcon,
  LayoutDashboardIcon,
  NetworkIcon,
  PackageIcon,
} from 'lucide-react';
import { Link, useLocation } from 'react-router';

export function MainNav() {
  const currentLocation = useLocation();

  const items: AppSidebarSection[] = [
    {
      items: [
        {
          label: 'Dashboard',
          to: '/home',
          icon: <LayoutDashboardIcon />,
        },
      ],
    },

    {
      //      title: 'Agents',
      items: [
        {
          label: 'Agents',
          to: '/agents',
          icon: <AgentIcon />,
        },
        {
          label: 'Workflows',
          to: '/workflows',
          icon: <WorkflowIcon />,
        },
      ],
    },
    {
      //   title: 'Observability',
      items: [
        {
          label: 'Observability',
          to: '/observability',
          icon: <EyeIcon />,
        },
      ],
    },
    {
      // title: 'Agents',
      items: [
        {
          label: 'Networks',
          to: '/networks',
          icon: <NetworkIcon />,
        },
        {
          label: 'Tools',
          to: '/tools',
          icon: <ToolsIcon />,
        },
        {
          label: 'MCP Servers',
          to: '/mcps',
          icon: <McpServerIcon />,
        },
        {
          label: 'Scorers',
          to: '/scorers',
          icon: <GaugeIcon />,
        },
        {
          label: 'Runtime Context',
          to: '/runtime-context',
          icon: <GlobeIcon />,
        },
        {
          label: 'Templates',
          to: '/templates',
          icon: <PackageIcon />,
        },
      ],
    },
    {
      items: [
        {
          label: 'Mastra APIs',
          href: 'http://localhost:4111/swagger-ui',
          icon: <EarthIcon />,
        },
        {
          label: 'Documentation',
          href: 'https://mastra.ai/en/docs',
          icon: <BookIcon />,
        },
        {
          label: 'Community',
          href: 'https://github.com/mastra-ai/mastra',
          icon: <GithubIcon />,
        },
        {
          label: 'Deploy to Mastra Cloud',
          href: 'https://mastra.ai/cloud',
          icon: <CloudUploadIcon />,
          variant: 'featured',
        },
      ],
    },
  ];

  return <AppSidebar items={items} linkComponent={Link} currentPath={currentLocation.pathname} />;
}
