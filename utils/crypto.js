
export const generateUUID = () => { 
    const uuid = crypto.randomUUID() ; 
    console.log(uuid) ; 
    return uuid ; 
}