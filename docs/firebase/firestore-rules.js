rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // Helper functions
    function isAuthenticated() {
      return request.auth != null;
    }
    
    function getUserData() {
      return get(/databases/$(database)/documents/users/$(request.auth.uid)).data;
    }
    
    function isOwner(userId) {
      return request.auth.uid == userId;
    }
    
    function isSuperAdmin() {
      return isAuthenticated() && 
             getUserData().role == 'super_admin';
    }
    
    function isAdmin() {
      return isAuthenticated() && 
             (getUserData().role == 'administrator' || isSuperAdmin());
    }
    
    function isSameOrganization(organizationId) {
      return getUserData().organizationId == organizationId;
    }
    
    function hasPermission(permission) {
      let userData = getUserData();
      return userData.permissions != null && 
             (userData.permissions.hasAny(['*']) || 
              userData.permissions.hasAny([permission]));
    }

    // ===========================================
    // ORGANIZATIONS - Acesso por Super Admin
    // ===========================================
    match /organizations/{orgId} {
      // Super admins podem ler/escrever qualquer organização
      allow read, write: if isSuperAdmin();
      
      // Admins da própria organização podem ler apenas a sua
      allow read: if isAuthenticated() && isSameOrganization(orgId);
      
      // Apenas super admins podem criar novas organizações
      allow create: if isSuperAdmin();
    }

    // ===========================================
    // USERS - Isolamento por organização
    // ===========================================
    match /users/{userId} {
      // Usuário pode sempre ler seus próprios dados
      allow read: if isOwner(userId);
      
      // Super admins podem ler qualquer usuário
      allow read: if isSuperAdmin();
      
      // Usuários da mesma organização podem se ver
      allow read: if isAuthenticated() && 
                     isSameOrganization(resource.data.organizationId);
      
      // Apenas admins podem criar usuários (na própria organização)
      allow create: if isAdmin() && 
                       (isSuperAdmin() || 
                        isSameOrganization(request.resource.data.organizationId));
      
      // Usuário pode atualizar seus próprios dados (campos limitados)
      allow update: if isOwner(userId) && 
                       !('role' in request.resource.data.diff(resource.data).affectedKeys()) &&
                       !('organizationId' in request.resource.data.diff(resource.data).affectedKeys()) &&
                       !('permissions' in request.resource.data.diff(resource.data).affectedKeys());
      
      // Admins podem atualizar usuários da própria organização
      allow update: if isAdmin() && 
                       (isSuperAdmin() || 
                        isSameOrganization(resource.data.organizationId));
      
      // Apenas admins podem deletar usuários
      allow delete: if isAdmin() && 
                       (isSuperAdmin() || 
                        isSameOrganization(resource.data.organizationId));
    }

    // ===========================================
    // VISITS - Isolamento por organização
    // ===========================================
    match /visits/{visitId} {
      // Usuários podem ler visitas da própria organização
      allow read: if isAuthenticated() && 
                     isSameOrganization(resource.data.organizationId);
      
      // Super admins podem ler qualquer visita
      allow read: if isSuperAdmin();
      
      // Usuários com permissão podem criar visitas
      allow create: if isAuthenticated() && 
                       hasPermission('visits:create') &&
                       isSameOrganization(request.resource.data.organizationId);
      
      // Criador da visita ou admin podem atualizar
      allow update: if isAuthenticated() && 
                       (resource.data.userId == request.auth.uid ||
                        hasPermission('visits:update')) &&
                       isSameOrganization(resource.data.organizationId);
      
      // Apenas admins podem deletar visitas
      allow delete: if isAuthenticated() && 
                       hasPermission('visits:delete') &&
                       isSameOrganization(resource.data.organizationId);
    }

    // ===========================================
    // COLLECTIONS - Isolamento por organização
    // ===========================================
    match /collections/{collectionId} {
      // Usuários podem ler coletas da própria organização
      allow read: if isAuthenticated() && 
                     isSameOrganization(resource.data.organizationId);
      
      // Super admins podem ler qualquer coleta
      allow read: if isSuperAdmin();
      
      // Usuários com permissão podem criar coletas
      allow create: if isAuthenticated() && 
                       hasPermission('collections:create') &&
                       isSameOrganization(request.resource.data.organizationId);
      
      // Criador da coleta ou admin podem atualizar
      allow update: if isAuthenticated() && 
                       (resource.data.userId == request.auth.uid ||
                        hasPermission('collections:update')) &&
                       isSameOrganization(resource.data.organizationId);
      
      // Apenas admins podem deletar coletas
      allow delete: if isAuthenticated() && 
                       hasPermission('collections:delete') &&
                       isSameOrganization(resource.data.organizationId);
    }

    // ===========================================
    // REPORTS - Isolamento por organização
    // ===========================================
    match /reports/{reportId} {
      // Usuários podem ler relatórios da própria organização
      allow read: if isAuthenticated() && 
                     isSameOrganization(resource.data.organizationId);
      
      // Super admins podem ler qualquer relatório
      allow read: if isSuperAdmin();
      
      // Usuários com permissão podem criar relatórios
      allow create: if isAuthenticated() && 
                       hasPermission('reports:create') &&
                       isSameOrganization(request.resource.data.organizationId);
      
      // Apenas criador ou admin podem atualizar
      allow update: if isAuthenticated() && 
                       (resource.data.userId == request.auth.uid ||
                        hasPermission('reports:update')) &&
                       isSameOrganization(resource.data.organizationId);
      
      // Apenas admins podem deletar relatórios
      allow delete: if isAuthenticated() && 
                       hasPermission('reports:delete') &&
                       isSameOrganization(resource.data.organizationId);
    }

    // ===========================================
    // DASHBOARD DATA - Isolamento por organização
    // ===========================================
    match /dashboard/{orgId} {
      // Usuários podem ler dashboard da própria organização
      allow read: if isAuthenticated() && isSameOrganization(orgId);
      
      // Super admins podem ler qualquer dashboard
      allow read: if isSuperAdmin();
      
      // Apenas sistema pode escrever dados de dashboard
      allow write: if isSuperAdmin();
    }

    // ===========================================
    // SYSTEM LOGS - Apenas Super Admin
    // ===========================================
    match /system_logs/{logId} {
      allow read, write: if isSuperAdmin();
    }

    // ===========================================
    // CONFIGURATIONS - Isolamento por organização
    // ===========================================
    match /configurations/{orgId} {
      // Usuários podem ler configurações da própria organização
      allow read: if isAuthenticated() && isSameOrganization(orgId);
      
      // Super admins podem ler qualquer configuração
      allow read: if isSuperAdmin();
      
      // Apenas admins podem atualizar configurações
      allow write: if isAdmin() && 
                      (isSuperAdmin() || isSameOrganization(orgId));
    }

    // ===========================================
    // NOTIFICATIONS - Isolamento por organização
    // ===========================================
    match /notifications/{notificationId} {
      // Usuários podem ler notificações da própria organização ou dirigidas a eles
      allow read: if isAuthenticated() && 
                     (isSameOrganization(resource.data.organizationId) ||
                      resource.data.userId == request.auth.uid);
      
      // Super admins podem ler qualquer notificação
      allow read: if isSuperAdmin();
      
      // Sistema pode criar notificações
      allow create: if isSuperAdmin();
      
      // Usuário pode marcar suas notificações como lidas
      allow update: if isAuthenticated() && 
                       resource.data.userId == request.auth.uid &&
                       request.resource.data.diff(resource.data).affectedKeys().hasOnly(['read', 'readAt']);
    }

    // ===========================================
    // OVITRAPS - Isolamento por organização
    // ===========================================
    match /ovitraps/{ovitrapId} {
      // Usuários podem ler ovitraps da própria organização
      allow read: if isAuthenticated() && 
                     isSameOrganization(resource.data.organizationId);
      
      // Super admins podem ler qualquer ovitrap
      allow read: if isSuperAdmin();
      
      // Usuários com permissão podem criar ovitraps
      allow create: if isAuthenticated() && 
                       hasPermission('ovitraps:create') &&
                       isSameOrganization(request.resource.data.organizationId);
      
      // Admins podem atualizar ovitraps da própria organização
      allow update: if isAuthenticated() && 
                       hasPermission('ovitraps:update') &&
                       isSameOrganization(resource.data.organizationId);
      
      // Apenas admins podem deletar ovitraps
      allow delete: if isAuthenticated() && 
                       hasPermission('ovitraps:delete') &&
                       isSameOrganization(resource.data.organizationId);
    }

    // ===========================================
    // STORAGE RULES
    // ===========================================
    // Obs: Storage rules ficam em um arquivo separado (storage.rules)
    // Mas a lógica é similar: isolamento por organizationId
  }
}

