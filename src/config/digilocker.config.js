                                                   
                                                                                       
  
                           
                                        
                                                
                                                                                 
                                                         
                                                           
  
                                                                                 
                                                                                
                                                                                  
                                              

const required = (name, fallback = undefined) => {
  const val = process.env[name] ?? fallback;
  return val;
};

module.exports = {
  clientId: required("DIGILOCKER_CLIENT_ID"),
  clientSecret: required("DIGILOCKER_CLIENT_SECRET"),
  redirectUri: required("DIGILOCKER_REDIRECT_URI"),
  baseUrl: required("DIGILOCKER_BASE_URL", "https://api.digitallocker.gov.in"),
  hmacSecret: required("DIGILOCKER_HMAC_SECRET"),

                                                                                        
  authorizeEndpoint: "/public/oauth2/1/authorize",
  tokenEndpoint: "/public/oauth2/1/token",
  issuedDocsEndpoint: "/public/oauth2/2/files/issued",
  fileFetchEndpoint: "/public/oauth2/1/file",

                                                              
  scopes: ["aadhaar", "pan"],

                                                                               
  matchThreshold: 85,

                                                
  stateMaxAgeMs: 10 * 60 * 1000,              

                                                                                 
                                                                                        
  mockMode: (process.env.DIGILOCKER_MOCK_MODE || "false").toLowerCase() === "true",
};