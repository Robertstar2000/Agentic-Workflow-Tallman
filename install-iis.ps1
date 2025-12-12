# IIS Configuration Script for Tallman Agent Production
# Run this script as Administrator to complete IIS setup

param(
    [string]$SiteName = "TallmanAgentProd",
    [string]$PhysicalPath = "C:\inetpub\TallmanAgentProd",
    [string]$BackendPort = "3560",
    [string]$DomainName = "agent.tallman.com"
)

Write-Host "=== IIS Configuration for Tallman Agent Production ===" -ForegroundColor Green

# Function to check and install IIS features
function Install-IISFeatures {
    Write-Host "Checking IIS features..." -ForegroundColor Yellow

    # Required IIS features
    $features = @(
        "IIS-WebServerRole",
        "IIS-WebServer",
        "IIS-ApplicationInit",
        "IIS-IPSecurity",
        "IIS-RequestFiltering",
        "IIS-URLRewrite",
        "IIS-ApplicationRequestRouting"
    )

    foreach ($feature in $features) {
        $status = Get-WindowsFeature -Name $feature
        if ($status.Installed -eq $false) {
            Write-Host "Installing $feature..." -ForegroundColor Cyan
            Install-WindowsFeature -Name $feature -IncludeManagementTools
        } else {
            Write-Host "$feature is already installed." -ForegroundColor Green
        }
    }
}

# Function to configure IIS site
function Configure-IISSite {
    Write-Host "Configuring IIS site..." -ForegroundColor Yellow

    # Import WebAdministration module
    Import-Module WebAdministration

    # Check if site exists, create if not
    $site = Get-IISSite | Where-Object { $_.Name -eq $SiteName }
    if (!$site) {
        Write-Host "Creating IIS site '$SiteName'..." -ForegroundColor Cyan

        New-IISSite -Name $SiteName -PhysicalPath $PhysicalPath -BindingInformation "*:80:$DomainName" -Protocol http

        # Set default document
        Set-WebConfigurationProperty -Filter "system.webServer/defaultDocument/files" -Name "value" -Value @("index.html") -PSPath IIS:\Sites\$SiteName

    } else {
        Write-Host "Site '$SiteName' already exists. Updating configuration..." -ForegroundColor Green

        # Update physical path
        Set-ItemProperty IIS:\Sites\$SiteName -Name physicalPath -Value $PhysicalPath

        # Update binding
        $binding = Get-WebBinding -Name $SiteName | Select-Object -First 1
        if ($binding) {
            Set-WebBinding -Name $SiteName -BindingInformation "*:80:$DomainName" -Protocol http
        }
    }
}

# Function to configure ARR and URL Rewrite
function Configure-ARRProxy {
    Write-Host "Configuring Application Request Routing..." -ForegroundColor Yellow

    # Enable ARR
    Set-WebConfigurationProperty -pspath "MACHINE/WEBROOT/APPHOST" -filter "system.webServer/arr" -name "enabled" -value "True"

    # Enable ARR server proxy
    Set-WebConfigurationProperty -pspath "MACHINE/WEBROOT/APPHOST" -filter "system.webServer/arr/serverProxy" -name "enabled" -value "True"

    # Create inbound rewrite rule for API proxy
    $ruleExists = Get-WebConfiguration -Filter "system.webServer/rewrite/rules/rule" -PSPath "IIS:\Sites\$SiteName" | Where-Object { $_.name -eq "API_Proxy" }

    if (!$ruleExists) {
        Write-Host "Creating API proxy rewrite rule..." -ForegroundColor Cyan

        Add-WebConfigurationProperty -PSPath "IIS:\Sites\$SiteName" -Filter "system.webServer/rewrite/rules" -Name "." -Value @{
            name = "API_Proxy"
            stopProcessing = "true"
        }

        Set-WebConfigurationProperty -PSPath "IIS:\Sites\$SiteName" -Filter "system.webServer/rewrite/rules/rule[@name='API_Proxy']/match" -Name "url" -Value "api/(.*)"

        Set-WebConfigurationProperty -PSPath "IIS:\Sites\$SiteName" -Filter "system.webServer/rewrite/rules/rule[@name='API_Proxy']/conditions" -Name "." -Value ""

        Set-WebConfigurationProperty -PSPath "IIS:\Sites\$SiteName" -Filter "system.webServer/rewrite/rules/rule[@name='API_Proxy']/action" -Name "type" -Value "Rewrite"

        Set-WebConfigurationProperty -PSPath "IIS:\Sites\$SiteName" -Filter "system.webServer/rewrite/rules/rule[@name='API_Proxy']/action" -Name "url" -Value "http://localhost:$BackendPort/api/{R:1}"

        Set-WebConfigurationProperty -PSPath "IIS:\Sites\$SiteName" -Filter "system.webServer/rewrite/rules/rule[@name='API_Proxy']/action" -Name "appendQueryString" -Value "True"

    } else {
        Write-Host "API proxy rewrite rule already exists." -ForegroundColor Green
    }

    # Configure ARR server proxy settings
    Set-WebConfigurationProperty -pspath "MACHINE/WEBROOT/APPHOST" -filter "system.webServer/arr/serverProxy" -name "maxRequestLength" -value "2097152"
    Set-WebConfigurationProperty -pspath "MACHINE/WEBROOT/APPHOST" -filter "system.webServer/arr/serverProxy" -name "timeout" -value "00:02:00"
}

# Function to create backend Windows service
function Setup-BackendService {
    Write-Host "Setting up backend Windows service..." -ForegroundColor Yellow

    Write-Host "Note: Backend service setup requires manual configuration." -ForegroundColor Yellow
    Write-Host "Please run the following manually:" -ForegroundColor White
    Write-Host "1. Build backend: cd server && npm install && npm run build" -ForegroundColor White
    Write-Host "2. Create Windows service for dist/server.js listening on port $BackendPort" -ForegroundColor White
    Write-Host "3. Alternatively, install NSSM: https://nssm.cc/" -ForegroundColor White
    Write-Host "4. Create service: nssm install TallmanAgentBackend C:\path\to\node.exe C:\path\to\simulated-chat\server\dist\server.js" -ForegroundColor White
    Write-Host "5. Configure service to restart on failure" -ForegroundColor White
}

# Function to verify configuration
function Verify-Configuration {
    Write-Host "Verifying IIS configuration..." -ForegroundColor Yellow

    try {
        # Check site exists
        $site = Get-IISSite | Where-Object { $_.Name -eq $SiteName }
        if ($site) {
            Write-Host "✓ IIS site '$SiteName' is configured" -ForegroundColor Green
        } else {
            Write-Host "✗ IIS site '$SiteName' not found" -ForegroundColor Red
        }

        # Check physical path
        $sitePath = Get-WebSite -Name $SiteName | Select-Object -ExpandProperty physicalPath
        if ($sitePath -eq $PhysicalPath) {
            Write-Host "✓ Physical path is correct: $PhysicalPath" -ForegroundColor Green
        } else {
            Write-Host "✗ Physical path mismatch: $sitePath" -ForegroundColor Red
        }

        # Check URL Rewrite rule
        $rule = Get-WebConfiguration -Filter "system.webServer/rewrite/rules/rule" -PSPath "IIS:\Sites\$SiteName" | Where-Object { $_.name -eq "API_Proxy" }
        if ($rule) {
            Write-Host "✓ URL Rewrite rule 'API_Proxy' exists" -ForegroundColor Green
        } else {
            Write-Host "✗ URL Rewrite rule 'API_Proxy' not found" -ForegroundColor Red
        }

        Write-Host "Configuration verification complete." -ForegroundColor Green

    } catch {
        Write-Host "Error during verification: $_" -ForegroundColor Red
    }
}

# Main execution
try {
    Write-Host "Starting IIS configuration..." -ForegroundColor Cyan

    Install-IISFeatures
    Configure-IISSite
    Configure-ARRProxy
    Setup-BackendService
    Verify-Configuration

    Write-Host ""
    Write-Host "=== Configuration Complete ===" -ForegroundColor Green
    Write-Host "1. Files have been copied to $PhysicalPath" -ForegroundColor White
    Write-Host "2. IIS site '$SiteName' configured" -ForegroundColor White
    Write-Host "3. API routing configured for port $BackendPort" -ForegroundColor White
    Write-Host "4. Backend service manuals provided above" -ForegroundColor White
    Write-Host ""
    Write-Host "Access your application at: http://$DomainName" -ForegroundColor Green
    Write-Host "API calls will be proxied to: http://localhost:$BackendPort" -ForegroundColor White

}
catch {
    $errorMessage = $_.Exception.Message
    Write-Host "Error during IIS configuration: $errorMessage" -ForegroundColor Red
    exit 1
}
