export const tryCatchAsync = async (promise) => { 
    try {
        const data = await promise ; 
        return [null, data] ; 
    } catch (error) {
        return [error,null] ; 
    }
};

export const tryCatchSync =  (fn) => { 
    try {
        const data = fn() ; 
        return [null, data] ; 
    } catch (error) {
        return [error, null] ; 
    }
};

