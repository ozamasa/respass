import { Server } from "ws"
import { Message } from "./models"
let findLatestMessage = (num: number) => {
  return Message.findAll({
    limit: num,
    order: "id DESC",
    raw: true
  }).then((messages) => {
    return messages.reverse()
  })
}

enum ReceiveEventType {
  CREATE_MESSAGE,
  DELETE_MESSAGE,
  JOIN,
  PONG,
  LEFT,
}
enum SendEventType {
  NEW_MESSAGE,
  DELETE_MESSAGE,
  USER_JOIN,
  USER_LEAVE,
  PING,
}

class BaseReceiveEvent {
  constructor(protected ev: ReceiveEventType, protected value: string) {
  }
  response(): string {
    return ""
  }
}
class CreateMessageEvent extends BaseReceiveEvent{
  response() {
    Message.create({text: this.value})
    return newMessage(SendEventType.NEW_MESSAGE, this.value) 
  }
}
class DeleteMessageEvent extends BaseReceiveEvent{
  response() {
    Message.destroy({where: {id: this.value}})
    return newMessage(SendEventType.DELETE_MESSAGE, this.value) 
  }
}
class JoinEvent extends BaseReceiveEvent {
  response() {
    return newMessage(SendEventType.USER_JOIN, this.value)
  }
}
class LeftEvent extends BaseReceiveEvent {
  response() {
    return newMessage(SendEventType.USER_LEAVE, this.value)
  }
}
let newMessage = (ev: SendEventType, value: string) => {
  return JSON.stringify({
    ev: SendEventType[ev],
    value: value,
  })
}
export let bootup = () => {
  let wss = new Server({port: 8080})

  let broadcast = (message: string): void => {
    wss.clients.forEach((client) => {
      client.send(message)
    })
  }
  
  wss.on('connection', (ws) => {
    // join event
    let response = new JoinEvent(ReceiveEventType.JOIN, "user joined").response()
    broadcast(response)

    // send latest 10 messages
    findLatestMessage(10).then((messages) => {
      messages.forEach((obj) => {
        ws.send(newMessage(SendEventType.NEW_MESSAGE, (<any>obj)["text"]))
      })
    })

    // ping/event
    // setInterval(() => {
      // try {
        // ws.send(newMessage(SendEventType.PING, ""))
      // } catch (e) {
        // clearInterval(this)
      // }
    // }, 2000)

    /*
     * expected json shceme:
     * {
     *   "ev": "CREATE_MESSAGE",
     *   "value": value,
     * }
     *
     * result json scheme:
     * {
     *   "ev":"NEW_MESSAGE",
     *   "value":""
     * }
     */
    ws.on('message', (undecoded_json: string) => {
      try {
        let json = JSON.parse(undecoded_json)
        let {ev, value} = json
        let messageEvent: BaseReceiveEvent

        if (ev === ReceiveEventType[ReceiveEventType.CREATE_MESSAGE]) {
          messageEvent = new CreateMessageEvent(ev, value)
        } else if (ev === ReceiveEventType[ReceiveEventType.DELETE_MESSAGE]) {
          messageEvent = new DeleteMessageEvent(ev, value)
        }
        broadcast(messageEvent.response())
      } catch(e) {
        // failed
      }
    })
    ws.on('close', () => {
      let response = new LeftEvent(ReceiveEventType.LEFT, "user left").response()
      try {
        broadcast(response)
      } catch(e) {
        // failed
      }
    })
  })
}