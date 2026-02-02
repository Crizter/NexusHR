import { SERVER_PORT } from "../config.js";

class SocketService { 
    constructor() { 
        this.socket = null  ; 
        this.url = `ws://localhost:${SERVER_PORT}` ; 
        this.reconnectTimer = null ; 
    }
    // setup the listeners 
    connect() { 
        if(this.socket && (this.socket.readyState === WebSocket.OPEN  || this.socket.readyState === WebSocket.CONNECTING)){
            return ; // socket is already created or connected 
        } 
        this.socket = new WebSocket(this.url) ; 

        this.socket.onopen = () => { 
        console.log('Successfully connected to socket') ; 
        if(this.reconnectTimer) clearTimeout(this.reconnectTimer) ; 

        }, 
        this.socket.onmessage = (event) => { 
            if(event.data === "PONG") return ; 
            console.log(`Message recieved ${event.data}`) ; 
            
            try {
                // dispatch the custom event 
                const data = JSON.parse(event.data) ; 
                const customEvent = new CustomEvent('socket-event', {detail: data}) ; 
                window.dispatchEvent(customEvent) ; 
            } catch (error) {
                console.warn("Received non-JSON message or parse error");
            }
            
        }
        this.socket.onclose = () => { 
            console.log(`Connection closed`) ; 
            this.socket = null ; 
            this.reconnectTimer = setTimeout(() => this.connect(), 5000) ; 
        }
        this.socket.onerror = (error) => { 
            console.error(`Ws error ${error}`)
        }
    }
    // send the paylaod 
    send(type,  payload = {}) { 
        if(this.socket && this.socket.readyState === WebSocket.OPEN){
            const message = JSON.stringify(payload) ;
             this.socket.send(message) ; 
        }
    } ;

}
export const socketService = new SocketService() ; 