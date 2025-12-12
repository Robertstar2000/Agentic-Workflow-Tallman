# LDAP Service Access Guide

## Service Information
- **Port**: 3100
- **Protocol**: HTTP
- **Base URL**: http://localhost:3100

## Available Endpoints

### Health Check
```
GET http://localhost:3100/api/health
Response: {"status":"LDAP authentication service is running"}
```

### LDAP Test Connectivity
```
GET http://localhost:3100/api/ldap-test
Response: {
  "success": true,
  "message": "LDAP connectivity test successful",
  "server": "dc02.tallman.com",
  "baseDN": "DC=tallman,DC=com"
}
```

### Authentication
```
POST http://localhost:3100/api/ldap-auth
Content-Type: application/json

{
  "username": "BobM",
  "password": "userpassword"
}

Response: {
  "authenticated": true,
  "server": "dc02.tallman.com",
  "user": {
    "cn": "Bob Miller",
    "memberOf": ["CN=Domain Users,CN=Users,DC=tallman,DC=com"],
    "dn": "CN=Bob Miller,CN=Users,DC=tallman,DC=com"
  }
}
```

## LDAP Configuration
- **Primary Server**: dc02.tallman.com
- **Fallback Servers**: 10.10.20.253, DC02
- **Base DN**: DC=tallman,DC=com
- **Service Account**: CN=LDAP,DC=tallman,DC=com
- **Port**: 389 (standard LDAP)
- **Timeout**: 15 seconds

## Testing with curl
```bash
# Health check
curl http://localhost:3100/api/health

# LDAP connectivity test
curl http://localhost:3100/api/ldap-test

# Authentication test
curl -X POST http://localhost:3100/api/ldap-auth \
  -H "Content-Type: application/json" \
  -d '{"username":"BobM","password":"yourpassword"}'
```

## Service Management
- **Start**: `start-ldap.bat`
- **Manual Start**: `cd server && set PORT=3100 && node ldap-auth.js`
- **Logs**: Console output shows authentication attempts and LDAP server responses

## Troubleshooting
1. **Service not responding**: Check if port 3100 is available
2. **LDAP errors**: Verify domain controller connectivity
3. **Authentication fails**: Check username format and LDAP server status
4. **Timeout errors**: Verify network connectivity to dc02.tallman.com
