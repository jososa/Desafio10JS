import { userService } from "../dao/services/users.service.js"
import { cartService } from "../dao/services/carts.service.js"
import { createHash, isValidPassword } from "../utils/utils.js"
import { logger } from "../utils/Logger.js"
import { environment } from "../config/config.js"
import UserDTO from "../dao/DTO/userDTO.js"
import MailingService from "../dao/services/mail.service.js"
import UserRepository from "../dao/repositories/usersRepositories.js"
import { generateToken, validateToken } from "../utils/jwt.js"
import { userRepository } from "../dao/repositories/index.js"

class UserController {

    async registerUser(req, username, password, done){
        const { first_name, last_name, email, age } = req.body
        try {
            const user = await userService.findUserByEmail(username)
            if(user){
                logger.warning("El usuario ya se encuentra registrado")
                return done(null, false)
            }

            const cart = await cartService.createCart()

            const newUser = {
                first_name,
                last_name,
                email,
                age,
                password: createHash(password),
                cart: cart,
                role: "usuario"
            }
            const result = userService.createUser(newUser)
            logger.info("Usuario creado con exito", newUser)
            return done(null, result)
        } catch (error) {
            logger.error(error)
            return done(error)
        }
    }

    async loginUser(username, password, done){
        try {
            if (
              username === "adminCoder@coder.com" &&
              password === "adminCod3r123"
            ) {

              const adminUser = {
                first_name: "Admin",
                last_name: "Coder",
                email: "adminCoder@coder.com",
                age: 33,
                role: "admin",
              }
              return done(null, adminUser)
            }
  
            const user = await userService.findUserByEmail(username)
            if (!user){
                logger.fatal("Usuario no encontrado")
                return done(null, false)
            }

            const valid = isValidPassword(user, password)
            if (!valid) return done(null, false)
  
            return done(null, user)
          } catch (error) {
            logger.error("Usuario no encontrado", error)
            return done(error)
          }
    }

    async loginGithub(accessToken, refreshToken, profile, done) {
        try {
            const user = userService.findUserByEmail(profile._json.email)
            if(!user){
                const newUser = {
                    first_name: profile._json.name,
                    last_name: "",
                    age: 33,
                    email: profile._json.email,
                    password: "",
                    role: "usuario"
                }
                let createdUser = await userService.createUser(newUser)
                done(null, createdUser)
            } else{
                done(null, user)
            }
        } catch (error) {
            logger.error("Usuario no encontrado", error)
            return done(error)
        }
    }

    async setUserRole(req, res) {
        const { uid } = req.params
        const user = await userService.findUserById(uid)
        
        if (user.role === "admin") {
          return res.status(400).json({ status: "error", message: "Los administradores no pueden cambiar rol" })
        }
    
        let newRole = null
        if (user.role === "premium") {
          newRole = { role: "usuario" }
        } else if (user.role === "usuario") {
          newRole = { role: "premium" }
        } else {
          return res.status(400).json({ status: "error", message: "Rol no válido" });
        }
    
        try {
          await userService.updateUser(user, newRole);
          res.send({ status: "success", message: "Se ha actualizado el rol" });
        } catch (error) {
          res
            .status(500)
            .json({ status: "error", message: "Error actualizando el rol" });
        }
      }

      async sendEmailToRestorePassword(req, res) {
        const { email } = req.body

        if (!email) return
    
        const user = await userRepository.findUserByEmail(email)
        if (!user)
          return res.status(400).json({ status: "error", message: "Usuario no encontrado" })
    
        const token = generateToken(user._id)
    
        const mailer = new MailingService()
        await mailer.sendMail({
          from: "E-commerce Admin",
          to: user.email,
          subject: "Recuperá tu contraseña",
          html: `<div><h1>¡Hacé click en el siguiente link para recuperar tu contraseña!</h1>
              <a href="http://localhost:${environment.port}/restorepass/${token}"}>Restaurá tu contraseña haciendo click aquí</a>
                  </div>`,
        });
        res.send({ status: "success", message: "Email enviado" })
      }
    
      async restorePassword(req, res) {
        const { password } = req.body
        const { token } = req.params
        const decodedToken = validateToken(token)
        if (!decodedToken) {
          return res.status(400).json({ status: "error", message: "Token invalido" })
        }
        const { userId } = decodedToken
    
        if (!password) {
          return res.status(400).json({ status: "error", message: "Password requerido" })
        }
    
        const user = await userRepository.findUserById(userId)
        if (!user) {
          return res.status(400).json({ status: "error", message: "No se encuentra el usuario" })
        }
    
        const passwordMatch = isValidPassword(user, password)
        if (passwordMatch) {
          return res.status(400).json({
            status: "error",
            message: "La nueva contraseña no puede ser igual a la antigua",
          });
        }
    
        const newPass = createHash(password)
        const passwordToUpdate = { password: newPass }
    
        await userRepository.updateUser(user, passwordToUpdate)
    
        res.status(200).json({ status: "success", message: "Password actualizado" })
      }
    
      async current(req, res) {
        if (!req.user) {
          res.status(403).json({ status: "Error", message: "No user authenticated" });
        }
        const currentUser = new UserDTO(req.user)
        res.status(200).json({ status: "success", payload: currentUser })
      }

}

export const userController = new UserController()