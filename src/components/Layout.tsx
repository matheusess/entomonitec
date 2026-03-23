import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import NotificationSystem from '@/components/NotificationSystem';
import MunicipalLogo from '@/components/MunicipalLogo';
import MunicipalSelector, { useDevMunicipalSelector } from '@/components/MunicipalSelector';
import { useMunicipalConfig, applyMunicipalTheme } from '@/lib/municipalConfig';
import {
  Bug,
  Home,
  MapPin,
  FileText,
  BarChart3,
  Settings,
  LogOut,
  Menu,
  X,
  User,
  Bell,
  Users,
  Shield,
  FileOutput,
  TrendingUp,
  Activity,
  Map
} from 'lucide-react';

interface LayoutProps {
  children: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const { user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const municipalConfig = useMunicipalConfig(user?.organization);
  const showDevSelector = useDevMunicipalSelector();

  // Aplicar tema municipal
  React.useEffect(() => {
    applyMunicipalTheme(municipalConfig);
  }, [municipalConfig]);

  const navigationItems = [
    {
      path: '/dashboard',
      label: 'Painel Geral',
      icon: Home,
      roles: ['supervisor', 'administrator'],
      description: 'Visão consolidada dos indicadores municipais'
    },
    {
      path: '/visits',
      label: 'Formulários',
      icon: MapPin,
      roles: ['agent', 'supervisor', 'administrator'],
      description: 'Registro de visitas e coletas de campo'
    },
    {
      path: '/registro-geografico',
      label: 'Registro Geográfico',
      icon: Map,
      roles: ['supervisor', 'administrator'],
      description: 'Gestão de quadras, imóveis e cobertura de visitas'
    },
    {
      path: '/operational',
      label: 'Operacional',
      icon: Users,
      roles: ['supervisor', 'administrator'],
      description: 'Gestão de equipes e performance'
    },
    {
      path: '/settings',
      label: 'Configurações',
      icon: Settings,
      roles: ['administrator'],
      description: 'Configurações do sistema e usuários'
    },
    {
      path: null, // Não é um link
      label: 'Super Admin',
      icon: Shield,
      roles: ['super_admin'],
      description: 'Gerenciamento de organizações e sistema'
    },

  ];

  const filteredNavItems = navigationItems.filter(item => 
    user?.role && item.roles.includes(user.role)
  );

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'agent': return 'bg-blue-500/10 text-blue-700 border-blue-200';
      case 'supervisor': return 'bg-amber-500/10 text-amber-700 border-amber-200';
      case 'administrator': return 'bg-emerald-500/10 text-emerald-700 border-emerald-200';
      case 'super_admin': return 'bg-purple-500/10 text-purple-700 border-purple-200';
      default: return 'bg-gray-500/10 text-gray-700 border-gray-200';
    }
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'agent': return 'Agente de Campo';
      case 'supervisor': return 'Supervisor';
      case 'administrator': return 'Coordenador';
      case 'super_admin': return 'Super Admin';
      default: return role;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Header Institucional */}
      <header className="bg-white border-b border-slate-200 shadow-sm">
        <div className="px-4 md:px-6">
          {/* Linha superior com informações institucionais */}
          <div className="flex items-center justify-between py-2 border-b border-slate-100">
            <div className="flex items-center space-x-4">
              <div className="text-xs text-slate-600">
                {municipalConfig.branding.headerTitle} • {municipalConfig.department}
              </div>
            </div>
            <div className="flex items-center space-x-4 text-xs text-slate-600">
              <span>Versão 2.1.1+a</span>
              <span>•</span>
              <span>{new Date().toLocaleDateString('pt-BR')}</span>
            </div>
          </div>

          {/* Linha principal do header */}
          <div className="flex items-center justify-between h-16">
            {/* Logo e informações municipais */}
            <div className="flex items-center space-x-4">
              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="md:hidden p-2 rounded-md hover:bg-slate-100"
              >
                {isMobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </button>
              
              {/* Brasão e identificação */}
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-3">
                  <MunicipalLogo size="md" municipalConfig={municipalConfig} />
                  <div>
                    <h1 className="font-bold text-lg text-slate-800">
                      {municipalConfig.name}
                    </h1>
                    <p className="text-sm text-slate-600">
                      {municipalConfig.branding.description} • {municipalConfig.state}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Ações do usuário */}
            <div className="flex items-center space-x-4">
              {/* Notificações */}
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="ghost" size="sm" className="relative">
                    <Bell className="h-4 w-4" />
                    <span className="absolute -top-1 -right-1 h-5 w-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                      3
                    </span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-96 p-0" align="end">
                  <div className="p-4 border-b bg-slate-50">
                    <h3 className="font-medium">Alertas do Sistema</h3>
                  </div>
                  <div className="max-h-96 overflow-y-auto p-4">
                    <div className="space-y-3">
                      <div className="flex items-start space-x-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                        <div className="w-2 h-2 bg-red-500 rounded-full mt-2"></div>
                        <div className="flex-1">
                          <p className="text-sm font-medium text-red-800">Nível Crítico Detectado</p>
                          <p className="text-xs text-red-600">7 bairros requerem ação imediata</p>
                          <p className="text-xs text-slate-500 mt-1">há 15 min</p>
                        </div>
                      </div>
                      <div className="flex items-start space-x-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                        <div className="w-2 h-2 bg-amber-500 rounded-full mt-2"></div>
                        <div className="flex-1">
                          <p className="text-sm font-medium text-amber-800">Amostragem Insuficiente</p>
                          <p className="text-xs text-amber-600">3 bairros abaixo da meta MS</p>
                          <p className="text-xs text-slate-500 mt-1">há 2h</p>
                        </div>
                      </div>
                      <div className="flex items-start space-x-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                        <div className="w-2 h-2 bg-blue-500 rounded-full mt-2"></div>
                        <div className="flex-1">
                          <p className="text-sm font-medium text-blue-800">Relatório Disponível</p>
                          <p className="text-xs text-blue-600">Consolidado semanal pronto</p>
                          <p className="text-xs text-slate-500 mt-1">há 4h</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
              
              {/* Perfil do usuário */}
              <div className="flex items-center space-x-3">
                <div className="text-right hidden sm:block">
                  <p className="text-sm font-medium text-slate-800">{user?.name}</p>
                  <div className="flex items-center justify-end space-x-2">
                    <Badge variant="outline" className={`text-xs ${getRoleBadgeColor(user?.role || '')}`}>
                      {getRoleLabel(user?.role || '')}
                    </Badge>
                  </div>
                </div>
                
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => router.push('/logout')}
                >
                  <LogOut className="h-4 w-4" />
                  <span className="hidden sm:inline ml-2">Sair</span>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="flex min-h-screen">
        {/* Sidebar - Desktop */}
        <aside className="hidden md:flex w-72 bg-white border-r border-slate-200 flex-col shadow-sm">
          <nav className="flex-1 p-4 space-y-2">
            <div className="mb-6">
              <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
                Navegação Principal
              </h2>
            </div>
            
            {filteredNavItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.path;
              
              // Se não tem path, renderiza como div (não clicável)
              if (!item.path) {
                return (
                  <div
                    key={item.label}
                    className="group flex items-center space-x-3 px-4 py-3 rounded-lg bg-slate-100 text-slate-500 cursor-default"
                    title={item.description}
                  >
                    <Icon className="h-5 w-5 text-slate-400" />
                    <div className="flex-1">
                      <span className="font-medium">{item.label}</span>
                      <p className="text-xs text-slate-400 mt-0.5">{item.description}</p>
                    </div>
                  </div>
                );
              }
              
              return (
                <Link
                  key={item.path}
                  href={item.path}
                  className={`group flex items-center space-x-3 px-4 py-3 rounded-lg transition-all duration-200 ${
                    isActive
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      : 'hover:bg-slate-50 text-slate-700 hover:text-slate-900'
                  }`}
                  title={item.description}
                >
                  <Icon className={`h-5 w-5 ${isActive ? 'text-emerald-600' : 'text-slate-500 group-hover:text-slate-700'}`} />
                  <div className="flex-1">
                    <span className="font-medium">{item.label}</span>
                    <p className="text-xs text-slate-500 mt-0.5">{item.description}</p>
                  </div>
                </Link>
              );
            })}
          </nav>

          {/* Informações do usuário */}
          <div className="p-4 border-t border-slate-200 bg-slate-50">
            <div className="flex items-center space-x-3 p-3 bg-white rounded-lg border">
              <div className="flex items-center justify-center w-10 h-10 bg-emerald-100 text-emerald-700 rounded-full">
                <User className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-900 truncate">{user?.name}</p>
                <p className="text-xs text-slate-500 truncate">{user?.organization?.name}</p>
              </div>
            </div>
            
            {/* Status do sistema */}
            <div className="mt-3 text-center">
              <div className="flex items-center justify-center space-x-2 text-xs text-slate-500">
                <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                <span>Sistema Online</span>
              </div>
            </div>
          </div>
        </aside>

        {/* Mobile Menu Overlay */}
        {isMobileMenuOpen && (
          <div className="md:hidden fixed inset-0 z-50 bg-black/50" onClick={() => setIsMobileMenuOpen(false)}>
            <aside className="w-80 bg-white h-full border-r flex flex-col" onClick={(e) => e.stopPropagation()}>
              <div className="p-4 border-b">
                <div className="flex items-center space-x-3">
                  <MunicipalLogo size="sm" municipalConfig={municipalConfig} />
                  <div>
                    <h2 className="font-bold text-slate-800">{municipalConfig.name}</h2>
                    <p className="text-sm text-slate-600">Vigilância Entomológica</p>
                  </div>
                </div>
              </div>
              
              <nav className="flex-1 p-4 space-y-2">
                {filteredNavItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = pathname === item.path;
                  
                  return (
                    <Link
                      key={item.path}
                      href={item.path || '#'}
                      onClick={() => setIsMobileMenuOpen(false)}
                      className={`flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${
                        isActive
                          ? 'bg-emerald-50 text-emerald-700'
                          : 'hover:bg-slate-50 text-slate-700'
                      }`}
                    >
                      <Icon className="h-5 w-5" />
                      <div>
                        <span className="font-medium">{item.label}</span>
                        <p className="text-xs text-slate-500">{item.description}</p>
                      </div>
                    </Link>
                  );
                })}
              </nav>

              <div className="p-4 border-t bg-slate-50">
                <div className="flex items-center space-x-3 p-3 bg-white rounded-lg">
                  <div className="flex items-center justify-center w-8 h-8 bg-emerald-100 text-emerald-700 rounded-full">
                    <User className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{user?.name}</p>
                    <p className="text-xs text-slate-500 truncate">{user?.organization?.name}</p>
                  </div>
                </div>
              </div>
            </aside>
          </div>
        )}

        {/* Main Content */}
        <main className="p-6 flex-1 bg-gradient-to-br from-slate-50 to-slate-100">
          {children}
        </main>
      </div>

      {/* Seletor Municipal para Desenvolvimento */}
      {showDevSelector && <MunicipalSelector />}
    </div>
  );
}
