#Requires -RunAsAdministrator
<#
.SYNOPSIS
    Complete automated deployment pipeline for Tallman-SuperAgent application
.DESCRIPTION
    Deploys React frontend to IIS, sets up Node.js backend services, configures SSL, and manages Windows services
.PARAMETER Action
    deploy, rollback, setup, health-check, ssl-setup, uninstall
.EXAMPLE
    .\deploy-tallman-chat.ps1 -Action setup
    .\deploy-tallman-chat.ps1 -Action deploy
#>

param(
    [Parameter(Mandatory=$false)]
    [ValidateSet('setup','deploy','rollback','health-check','ssl-setup','uninstall')]
    [string]$Action = 'deploy',
    
    [string]$Domain = 'SuperAgent.tallman.com',
    [string]$Email = 'admin@tallman.com',
    [string]$DeploymentPath = 'C:\inetpub\wwwroot\tallman-chat',
    [string]$ServicePath = 'C:\Services\TallmanSuperAgent',
    [string]$BackupPath = 'C:\Backups\TallmanSuperAgent',
    [string]$BuildPath = '.',
    [string]$RollbackVersion = ''
)

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

# ============================================================================
# CONFIGURATION
# ============================================================================

$Config = @{
    SiteName = 'TallmanSuperAgent'
    MainServiceName = 'TallmanSuperAgentMain'
    LDAPServiceName = 'TallmanSuperAgentDAP'
    OllamaServiceName = 'Ollama'
    MainPort = 3260
    BackendPort = 3260
    LDAPPort = 3260
    OllamaPort = 11434
    NodePath = 'C:\Program Files\nodejs\node.exe'
    NSSMPath = 'C:\ProgramData\chocolatey\bin\nssm.exe'
}

# ============================================================================
# UTILITY FUNCTIONS
# ============================================================================

function Write-Step {
    param([string]$Message, [string]$Color = 'Cyan')
    Write-Host "`n==> $Message" -ForegroundColor $Color
}

function Write-Success {
    param([string]$Message)
    Write-Host "✓ $Message" -ForegroundColor Green
}

function Write-Error-Custom {
    param([string]$Message)
    Write-Host "✗ $Message" -ForegroundColor Red
}

function Test-Administrator {
    $currentUser = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = New-Object Security.Principal.WindowsPrincipal($currentUser)
    return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

function Install-Prerequisites {
    Write-Step "Installing Prerequisites"
    
    # Install Chocolatey
    if (-not (Get-Command choco -ErrorAction SilentlyContinue)) {
        Write-Host "Installing Chocolatey..."
        Set-ExecutionPolicy Bypass -Scope Process -Force
        [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072
        iex ((New-Object System.Net.WebClient).DownloadString('https://chocolatey.org/install.ps1'))
        $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
    }
    
    # Install required software
    $packages = @('nodejs-lts', 'git', 'urlrewrite', 'nssm')
    foreach ($package in $packages) {
        if (-not (choco list --local-only | Select-String $package)) {
            Write-Host "Installing $package..."
            choco install $package -y --no-progress
        }
    }
    
    # Enable IIS features
    $features = @(
        'IIS-WebServerRole',
        'IIS-WebServer',
        'IIS-CommonHttpFeatures',
        'IIS-HttpErrors',
        'IIS-ApplicationInit',
        'IIS-HealthAndDiagnostics',
        'IIS-HttpLogging',
        'IIS-Security',
        'IIS-RequestFiltering',
        'IIS-Performance',
        'IIS-HttpCompressionStatic',
        'IIS-WebServerManagementTools',
        'IIS-ManagementConsole'
    )
    
    foreach ($feature in $features) {
        Enable-WindowsOptionalFeature -Online -FeatureName $feature -NoRestart -ErrorAction SilentlyContinue | Out-Null
    }
    
    Write-Success "Prerequisites installed"
}

# ============================================================================
# BACKUP FUNCTIONS
# ============================================================================

function New-Backup {
    Write-Step "Creating Backup"
    
    $timestamp = Get-Date -Format 'yyyyMMdd-HHmmss'
    $backupFolder = Join-Path $BackupPath $timestamp
    
    if (Test-Path $DeploymentPath) {
        New-Item -ItemType Directory -Path $backupFolder -Force | Out-Null
        Copy-Item -Path "$DeploymentPath\*" -Destination $backupFolder -Recurse -Force
        Write-Success "Backup created: $backupFolder"
        return $timestamp
    }
    return $null
}

function Restore-Backup {
    param([string]$Version)
    
    Write-Step "Restoring Backup: $Version"
    
    $backupFolder = Join-Path $BackupPath $Version
    if (-not (Test-Path $backupFolder)) {
        throw "Backup version $Version not found"
    }
    
    Stop-Services
    Remove-Item -Path "$DeploymentPath\*" -Recurse -Force -ErrorAction SilentlyContinue
    Copy-Item -Path "$backupFolder\*" -Destination $DeploymentPath -Recurse -Force
    Start-Services
    
    Write-Success "Backup restored successfully"
}

# ============================================================================
# SERVICE MANAGEMENT
# ============================================================================

function Stop-Services {
    Write-Step "Stopping Services"
    
    $services = @($Config.MainServiceName, $Config.LDAPServiceName)
    foreach ($serviceName in $services) {
        $service = Get-Service -Name $serviceName -ErrorAction SilentlyContinue
        if ($service -and $service.Status -eq 'Running') {
            Stop-Service -Name $serviceName -Force
            Write-Success "Stopped $serviceName"
        }
    }
}

function Start-Services {
    Write-Step "Starting Services"
    
    $services = @($Config.MainServiceName, $Config.LDAPServiceName)
    foreach ($serviceName in $services) {
        $service = Get-Service -Name $serviceName -ErrorAction SilentlyContinue
        if ($service) {
            Start-Service -Name $serviceName
            Write-Success "Started $serviceName"
        }
    }
}

function Install-WindowsServices {
    Write-Step "Installing Windows Services"
    
    # Create service directory and logs
    New-Item -ItemType Directory -Path $ServicePath -Force | Out-Null
    New-Item -ItemType Directory -Path "$ServicePath\logs" -Force | Out-Null
    
    # Main Agent Service
    Write-Host "Setting up $($Config.MainServiceName)..."
    & $Config.NSSMPath remove $Config.MainServiceName confirm 2>$null
    & $Config.NSSMPath install $Config.MainServiceName $Config.NodePath "$ServicePath\production-server.js"
    & $Config.NSSMPath set $Config.MainServiceName AppDirectory $ServicePath
    & $Config.NSSMPath set $Config.MainServiceName DisplayName "Tallman Super Agent Service"
    & $Config.NSSMPath set $Config.MainServiceName Description "Main API service for Tallman Chat"
    & $Config.NSSMPath set $Config.MainServiceName Start SERVICE_AUTO_START
    & $Config.NSSMPath set $Config.MainServiceName AppStdout "$ServicePath\logs\main-service.log"
    & $Config.NSSMPath set $Config.MainServiceName AppStderr "$ServicePath\logs\main-error.log"
    & $Config.NSSMPath set $Config.MainServiceName AppRotateFiles 1
    & $Config.NSSMPath set $Config.MainServiceName AppRotateBytes 1048576
    
    # LDAP Auth Service
    Write-Host "Setting up $($Config.LDAPServiceName)..."
    & $Config.NSSMPath remove $Config.LDAPServiceName confirm 2>$null
    & $Config.NSSMPath install $Config.LDAPServiceName $Config.NodePath "$ServicePath\ldap-auth.js"
    & $Config.NSSMPath set $Config.LDAPServiceName AppDirectory $ServicePath
    & $Config.NSSMPath set $Config.LDAPServiceName DisplayName "Tallman Super Agent LDAP Service"
    & $Config.NSSMPath set $Config.LDAPServiceName Description "LDAP authentication for Tallman Super Agent"
    & $Config.NSSMPath set $Config.LDAPServiceName Start SERVICE_AUTO_START
    & $Config.NSSMPath set $Config.LDAPServiceName AppStdout "$ServicePath\logs\ldap-service.log"
    & $Config.NSSMPath set $Config.LDAPServiceName AppStderr "$ServicePath\logs\ldap-error.log"
    & $Config.NSSMPath set $Config.LDAPServiceName AppRotateFiles 1
    & $Config.NSSMPath set $Config.LDAPServiceName AppRotateBytes 1048576
    
    # Install Ollama if not present
    if (-not (Get-Service -Name $Config.OllamaServiceName -ErrorAction SilentlyContinue)) {
        Write-Host "Installing Ollama..."
        $ollamaUrl = "https://ollama.ai/download/ollama-windows-amd64.exe"
        $ollamaInstaller = "$env:TEMP\ollama-installer.exe"
        Invoke-WebRequest -Uri $ollamaUrl -OutFile $ollamaInstaller -UseBasicParsing
        Start-Process -FilePath $ollamaInstaller -ArgumentList "/S" -Wait
        Remove-Item $ollamaInstaller -Force
    }
    
    Write-Success "Windows services installed"
}

function Remove-WindowsServices {
    Write-Step "Removing Windows Services"
    
    $services = @($Config.MainServiceName, $Config.LDAPServiceName)
    foreach ($serviceName in $services) {
        $service = Get-Service -Name $serviceName -ErrorAction SilentlyContinue
        if ($service) {
            Stop-Service -Name $serviceName -Force -ErrorAction SilentlyContinue
            & $Config.NSSMPath remove $serviceName confirm
            Write-Success "Removed $serviceName"
        }
    }
}

# ============================================================================
# IIS CONFIGURATION
# ============================================================================

function Install-IISConfiguration {
    Write-Step "Configuring IIS"
    
    Import-Module WebAdministration -ErrorAction SilentlyContinue
    
    # Create deployment directory
    New-Item -ItemType Directory -Path $DeploymentPath -Force | Out-Null
    
    # Remove existing site
    if (Get-Website -Name $Config.SiteName -ErrorAction SilentlyContinue) {
        Remove-Website -Name $Config.SiteName
    }
    
    # Create website
    New-Website -Name $Config.SiteName -Port 80 -PhysicalPath $DeploymentPath -Force
    
    # Create web.config
    $webConfig = @"
<?xml version="1.0" encoding="UTF-8"?>
<configuration>
    <system.webServer>
        <rewrite>
            <rules>
                <rule name="API Proxy" stopProcessing="true">
                    <match url="^api/(.*)" />
                    <action type="Rewrite" url="http://localhost:$($Config.MainPort)/api/{R:1}" />
                </rule>
                <rule name="LDAP Proxy" stopProcessing="true">
                    <match url="^auth/(.*)" />
                    <action type="Rewrite" url="http://localhost:$($Config.LDAPPort)/auth/{R:1}" />
                </rule>
                <rule name="SPA Fallback" stopProcessing="true">
                    <match url=".*" />
                    <conditions logicalGrouping="MatchAll">
                        <add input="{REQUEST_FILENAME}" matchType="IsFile" negate="true" />
                        <add input="{REQUEST_FILENAME}" matchType="IsDirectory" negate="true" />
                    </conditions>
                    <action type="Rewrite" url="/index.html" />
                </rule>
            </rules>
        </rewrite>
        <staticContent>
            <mimeMap fileExtension=".json" mimeType="application/json" />
            <mimeMap fileExtension=".woff2" mimeType="font/woff2" />
        </staticContent>
        <httpProtocol>
            <customHeaders>
                <add name="X-Frame-Options" value="DENY" />
                <add name="X-Content-Type-Options" value="nosniff" />
                <add name="Referrer-Policy" value="strict-origin-when-cross-origin" />
                <add name="Strict-Transport-Security" value="max-age=31536000; includeSubDomains" />
            </customHeaders>
        </httpProtocol>
        <httpCompression>
            <dynamicTypes>
                <add mimeType="application/json" enabled="true" />
            </dynamicTypes>
        </httpCompression>
    </system.webServer>
</configuration>
"@
    
    $webConfig | Out-File -FilePath "$DeploymentPath\web.config" -Encoding UTF8 -Force
    
    Write-Success "IIS configured"
}

# ============================================================================
# SSL CONFIGURATION
# ============================================================================

function Install-SSL {
    Write-Step "Setting up SSL Certificate"
    
    # Install Certbot
    if (-not (Get-Command certbot -ErrorAction SilentlyContinue)) {
        choco install certbot -y --no-progress
    }
    
    # Stop IIS temporarily
    Stop-Service W3SVC
    
    try {
        # Request certificate
        certbot certonly --standalone --non-interactive --agree-tos --email $Email -d $Domain
        
        # Import certificate to IIS
        $certPath = "C:\Certbot\live\$Domain"
        if (Test-Path "$certPath\fullchain.pem") {
            # Convert PEM to PFX
            $pfxPath = "$certPath\certificate.pfx"
            $pemCert = Get-Content "$certPath\fullchain.pem" -Raw
            $pemKey = Get-Content "$certPath\privkey.pem" -Raw
            
            # Import to certificate store
            $cert = Import-Certificate -FilePath "$certPath\fullchain.pem" -CertStoreLocation Cert:\LocalMachine\My
            
            # Bind to IIS
            Import-Module WebAdministration
            if (-not (Get-WebBinding -Name $Config.SiteName -Protocol https -ErrorAction SilentlyContinue)) {
                New-WebBinding -Name $Config.SiteName -Protocol https -Port 443 -IPAddress "*"
            }
            
            $binding = Get-WebBinding -Name $Config.SiteName -Protocol https
            $binding.AddSslCertificate($cert.Thumbprint, "my")
            
            Write-Success "SSL certificate installed"
        }
    }
    finally {
        Start-Service W3SVC
    }
    
    # Setup auto-renewal
    $taskAction = New-ScheduledTaskAction -Execute "certbot" -Argument "renew --quiet --post-hook `"iisreset`""
    $taskTrigger = New-ScheduledTaskTrigger -Daily -At "2:00AM"
    $taskSettings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries
    
    Unregister-ScheduledTask -TaskName "CertbotRenewal" -Confirm:$false -ErrorAction SilentlyContinue
    Register-ScheduledTask -TaskName "CertbotRenewal" -Action $taskAction -Trigger $taskTrigger -Settings $taskSettings -User "SYSTEM" -RunLevel Highest
    
    Write-Success "SSL auto-renewal configured"
}

# ============================================================================
# FIREWALL CONFIGURATION
# ============================================================================

function Install-FirewallRules {
    Write-Step "Configuring Firewall"
    
    $rules = @(
        @{Name="Tallman Chat HTTP"; Port=80},
        @{Name="Tallman Chat HTTPS"; Port=443}
    )
    
    foreach ($rule in $rules) {
        Remove-NetFirewallRule -DisplayName $rule.Name -ErrorAction SilentlyContinue
        New-NetFirewallRule -DisplayName $rule.Name -Direction Inbound -Protocol TCP -LocalPort $rule.Port -Action Allow | Out-Null
        Write-Success "Firewall rule: $($rule.Name)"
    }
}

# ============================================================================
# DEPLOYMENT
# ============================================================================

function Deploy-Application {
    Write-Step "Deploying Application"
    
    # Create backup
    $backupVersion = New-Backup
    
    # Stop services
    Stop-Services
    
    # Find and extract build
    $zipFile = Get-ChildItem -Path $BuildPath -Filter "tallman-chat-*.zip" -ErrorAction SilentlyContinue | Select-Object -First 1
    
    if (-not $zipFile) {
        # Build locally if no zip found
        Write-Host "No build package found, building locally..."
        Push-Location $BuildPath
        npm install
        npm run build
        Pop-Location
        
        # Copy build files
        if (Test-Path "$BuildPath\dist") {
            Copy-Item -Path "$BuildPath\dist\*" -Destination $DeploymentPath -Recurse -Force
        }
    }
    else {
        # Extract zip
        Expand-Archive -Path $zipFile.FullName -DestinationPath $DeploymentPath -Force
    }
    
    # Copy server files
    if (Test-Path "$BuildPath\server") {
        Copy-Item -Path "$BuildPath\server\*" -Destination $ServicePath -Recurse -Force
    }
    
    # Create environment file
    $envContent = @"
NODE_ENV=production
PORT=$($Config.MainPort)
LDAP_PORT=$($Config.LDAPPort)
OLLAMA_URL=http://localhost:$($Config.OllamaPort)
LOG_LEVEL=info
"@
    
    $envContent | Out-File -FilePath "$ServicePath\.env" -Encoding UTF8 -Force
    
    # Install dependencies
    if (Test-Path "$ServicePath\package.json") {
        Push-Location $ServicePath
        npm install --production
        Pop-Location
    }
    
    # Start services
    Start-Services
    
    Write-Success "Application deployed"
}

# ============================================================================
# HEALTH CHECK
# ============================================================================

function Test-Health {
    Write-Step "Performing Health Checks"
    
    $endpoints = @(
        @{Url="http://localhost:$($Config.MainPort)/api/health"; Name="Main API"},
        @{Url="http://localhost:$($Config.LDAPPort)/auth/health"; Name="LDAP Service"},
        @{Url="http://localhost"; Name="IIS Frontend"}
    )
    
    $allHealthy = $true
    
    foreach ($endpoint in $endpoints) {
        try {
            $response = Invoke-WebRequest -Uri $endpoint.Url -TimeoutSec 10 -UseBasicParsing
            if ($response.StatusCode -eq 200) {
                Write-Success "$($endpoint.Name) - OK"
            }
            else {
                Write-Error-Custom "$($endpoint.Name) - Status: $($response.StatusCode)"
                $allHealthy = $false
            }
        }
        catch {
            Write-Error-Custom "$($endpoint.Name) - Error: $($_.Exception.Message)"
            $allHealthy = $false
        }
    }
    
    # Check services
    $services = @($Config.MainServiceName, $Config.LDAPServiceName)
    foreach ($serviceName in $services) {
        $service = Get-Service -Name $serviceName -ErrorAction SilentlyContinue
        if ($service -and $service.Status -eq 'Running') {
            Write-Success "Service $serviceName - Running"
        }
        else {
            Write-Error-Custom "Service $serviceName - Not running"
            $allHealthy = $false
        }
    }
    
    return $allHealthy
}

# ============================================================================
# MAIN EXECUTION
# ============================================================================

function Main {
    if (-not (Test-Administrator)) {
        throw "This script must be run as Administrator"
    }
    
    Write-Host @"
╔═══════════════════════════════════════════════════════════╗
║     Tallman Chat Automated Deployment Pipeline           ║
║     Action: $($Action.PadRight(47))║
╚═══════════════════════════════════════════════════════════╝
"@ -ForegroundColor Cyan
    
    try {
        switch ($Action) {
            'setup' {
                Install-Prerequisites
                Install-IISConfiguration
                Install-WindowsServices
                Install-FirewallRules
                Write-Host "`n✓ Setup completed successfully!" -ForegroundColor Green
            }
            
            'deploy' {
                Deploy-Application
                Test-Health
                Write-Host "`n✓ Deployment completed successfully!" -ForegroundColor Green
            }
            
            'rollback' {
                if (-not $RollbackVersion) {
                    $backups = Get-ChildItem -Path $BackupPath -Directory | Sort-Object Name -Descending
                    if ($backups) {
                        Write-Host "`nAvailable backups:"
                        $backups | ForEach-Object { Write-Host "  - $($_.Name)" }
                        $RollbackVersion = Read-Host "`nEnter backup version to restore"
                    }
                    else {
                        throw "No backups found"
                    }
                }
                Restore-Backup -Version $RollbackVersion
                Write-Host "`n✓ Rollback completed successfully!" -ForegroundColor Green
            }
            
            'health-check' {
                $healthy = Test-Health
                if ($healthy) {
                    Write-Host "`n✓ All systems healthy!" -ForegroundColor Green
                }
                else {
                    Write-Host "`n✗ Some systems are unhealthy" -ForegroundColor Red
                    exit 1
                }
            }
            
            'ssl-setup' {
                Install-SSL
                Write-Host "`n✓ SSL setup completed successfully!" -ForegroundColor Green
            }
            
            'uninstall' {
                Stop-Services
                Remove-WindowsServices
                if (Get-Website -Name $Config.SiteName -ErrorAction SilentlyContinue) {
                    Remove-Website -Name $Config.SiteName
                }
                Write-Host "`n✓ Uninstall completed successfully!" -ForegroundColor Green
            }
        }
    }
    catch {
        Write-Host "`n✗ Error: $($_.Exception.Message)" -ForegroundColor Red
        exit 1
    }
}

# Execute
Main
