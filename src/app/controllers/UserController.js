import User from "../models/User";

class UserController {
  async store(request, response) {
    const usersExists = await User.findOne({ where: {email: request.body.email} });

    if (usersExists) {
      return response.status(400).json({ error: 'User already exists.' });
    }

    const { id, name, email, provider } = await User.create(request.body);
    return response.json({
      id,
      name,
      email,
      provider
    });
  }

  async update(request, response) {
    const { email, oldPassword } = request.body;

    const user = await User.findByPk(request.userId);

    // Verifica se o email que o usuário quer editar já existe
    if (email && (email !== user.email)) {
      const usersExists = await User.findOne({ where: { email } });

      if (usersExists) {
        return response.status(400).json({ error: 'User already exists.' });
      }
    }

    if (oldPassword && !(await user.checkPassword(oldPassword))) {
      return response.status(401).json({ error: 'Paasword does not match' });
    }

    const { id, name, provider } = await user.update(request.body);

    return response.json({
      id,
      name,
      email,
      provider
    });
  }
}

export default new UserController();
