import { Router } from "express"
import { userController } from "../controllers/userController.js"

const userRouter = Router()

userRouter.post("/premium/:uid", userController.setUserRole)

export default userRouter