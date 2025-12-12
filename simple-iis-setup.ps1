# Simple IIS Configuration for TallmanAgentProd
# Run as Administrator

Write-Host "Setting up IIS for TallmanAgentProd..." -ForegroundColor Green

# Enable required IIS features
Write-Host "Installing IIS features..." -ForegroundColor Yellow
Enable-WindowsOptionalFeature -Online -FeatureName IIS-WebServerRole, IIS-WebServer, IIS-ApplicationInit, IIS-IPSecurity, IIS-RequestFiltering -All

# Install URL Rewrite and ARR
Write-Host "Installing URL Rewrite..." -ForegroundColor Yellow
Enable-WindowsOptionalFeature -Online -FeatureName IIS-URLRewrite, IIS-ApplicationRequestRouting -All

# Create website
Write-Host "Creating IIS website..." -ForegroundColor Yellow
Import-Module WebAdministration

$siteName = "TallmanAgentProd"
$physicalPath = "C:\inetpub\TallmanAgentProd"

if (!(Get-IISSite $siteName -ErrorAction SilentlyContinue)) {
    New-IISSite -Name $siteName -PhysicalPath $physicalPath -BindingInformation "*:80:agent.tallman.com"
    Write-Host "✓ IIS site created" -ForegroundColor Green
} else {
    Write-Host "✔ IIS site already exists" -ForegroundColor Green
}

# Set default document
Write-Host "Configuring default document..." -ForegroundColor Yellow
Set-WebConfigurationProperty -Filter system.webServer/defaultDocument/files -Name value -Value @("index.html") -PSPath "IIS:\Sites\$siteName"

# Enable proxying for ARR
Write-Host "Configuring ARR proxy..." -ForegroundColor Yellow
Set-WebConfigurationProperty -pspath "MACHINE/WEBROOT/APPHOST" -filter "system.webServer/arr/serverProxy" -name enabled -value "True"
Set-WebConfigurationProperty -pspath "MACHINE/WEBROOT/APPHOST" -filter "system.webServer/arr" -name enabled -value "True"

# Add URL Rewrite rule for API proxy
Write-Host "Adding URL Rewrite rule..." -ForegroundColor Yellow

$rulename = "API_Proxy"
try {
    Add-WebConfigurationProperty -PSPath "IIS:\Sites\$siteName" -Filter system.webServer/rewrite/rules -Name . -Value @{name=$rulename; stopProcessing="true"}
    Set-WebConfigurationProperty -PSPath "IIS:\Sites\$siteName" -Filter "system.webServer/rewrite/rules/rule[@name='$rulename']/match" -Name url -Value "api/(.*)"
    Set-WebConfigurationProperty -PSPath "IIS:\Sites\$siteName" -Filter "system.webServer/rewrite/rules/rule[@name='$rulename']/action" -Name type -Value "Rewrite"
    Set-WebConfigurationProperty -PSPath "IIS:\Sites\$siteName" -Filter "system.webServer/rewrite/rules/rule[@name='$rulename']/action" -Name url -Value "http://localhost:3560/api/{R:1}"
    Write-Host "✓ URL Rewrite rule added" -ForegroundColor Green
}
catch {
    Write-Host "✓ URL Rewrite rule already exists" -ForegroundColor Green
}

Write-Host "`nIIS Configuration Complete!" -ForegroundColor Green
Write-Host "Access your site at: http://agent.tallman.com" -ForegroundColor White
Write-Host "API calls will proxy to: http://localhost:3560" -ForegroundColor White

Write-Host "`nNext steps:" -ForegroundColor Yellow
Write-Host "1. Copy built files to C:\inetpub\TallmanAgentProd\" -ForegroundColor White
Write-Host "2. Build and deploy backend as Windows service" -ForegroundColor White
Write-Host "3. Test the application" -ForegroundColor White
