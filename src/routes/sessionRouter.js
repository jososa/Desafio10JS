import { Router } from "express"
//import usersService from "../dao/services/users.service.js"
import userDTO from "../dao/DTO/userDTO.js"
import { userRepository } from "../dao/repositories/index.js"
import { createHash, isValidPassword } from "../utils/utils.js"
import passport from "passport"
import { environment } from "../config/config.js"
import MailingService from "../dao/services/mail.service.js"

const sessionRouter = Router()

//Registro de Usuario
sessionRouter.post("/register", passport.authenticate('register',{failureRedirect:'/failregister'}), async(req,res) =>{
  res.status(201).send({status: "success", message: "Usuario registrado"})
})

sessionRouter.get("/failregister", async(req, res)=>{
  req.logger.error("Falló el registro")
  res.status(400).json({ error: "Falló el registro" })
})

//Login de Usuario
sessionRouter.post("/login", passport.authenticate('login',{failureRedirect:"/faillogin"}), async(req, res)=>{
  console.log("Entro al router")
  if(!req.user){
    return res.status(400).send('error')
  }
  req.session.user = {
    first_name: req.user.first_name,
    last_name: req.user.last_name,
    email: req.user.email,
    age: req.user.age,
    role: req.user.role
  }
  req.logger.info("Usuario logueado", req.session.user)
  res.status(200).json({ status: "success", payload: req.user })
})

sessionRouter.get("/faillogin", async(req, res)=>{
  console.log("error")
  res.send({error:"Fallo"})
})

sessionRouter.get("/github", passport.authenticate("github", {scope:["user:email"]}),
  async (req, res) => {
    res.send({status:"success", message: res})
  }
)

sessionRouter.get("/githubcallback", passport.authenticate("github", {failureRedirect:["/login"]}),
  async (req, res) => {
    req.session.user = req.user
    res.redirect("/")
  }
)

sessionRouter.get("/logout", (req, res) => {
  req.session.destroy((err) => {
    if (!err) {
      res.send({ status: "success", message: "Sesión cerrada" })
    } else {
      res.send({ error: err })
    }
  })
})

sessionRouter.get("/current", async (req, res) => {
  if (!req.user) {
    res.status(403).send({ status: "Error", message: "Usuario no autenticado" })
  }
  const result = new userDTO(req.user)
  res.status(200).json({ status: "success", payload: result })
})

//Restaurar password
sessionRouter.post("/restore", async (req, res) => {
  const {email} = req.body
  if(!email) return

  const user = await userRepository.findUserByEmail(email)
  if(!user){
    return res.status(400).send({status: "error", message:"No se encuentra usuario"})
  }

  const mailer = new MailingService()
  await mailer.sendMail({
    from: "E-commerce Admin",
    to: user.email,
    subject: "Restablecer contraseña",
    html: `<div><h1>Ingrese en el siguiente link para recuperar su contraseña: </h1>
        <a href="http://localhost:${environment.port}/restorepass/${user._id}"}>Restablezca su contraseña haciendo click aquí</a>
            </div>`,
  })

  // const newPass = createHash(password)
  // const pwd = {password: newPass}
  // await userRepository.updateUser(user, pwd)
  res.send({status:"success", message: "Email enviado"})
})

sessionRouter.post("/:uid/restorepass", async (req, res) => {
  const { password } = req.body
  const { uid } = req.params

  if (!password) {
    return res
      .status(400)
      .json({ status: "error", message: "Password requerido" });
  }

  const user = await userRepository.findUserById(uid);
  if (!user) {
    return res
      .status(400)
      .json({ status: "error", message: "No se encuentra el usuario" });
  }

  const passwordMatch = isValidPassword(user, password);
  if (passwordMatch) {
    return res.status(400).json({
      status: "error",
      message: "La nueva contraseña no puede ser igual a la antigua",
    });
  }

  const newPass = createHash(password);
  const passwordToUpdate = { password: newPass };

  await userRepository.updateUser(user, passwordToUpdate);

  res.status(200).json({ status: "success", message: "Password actualizado" });
})

export default sessionRouter