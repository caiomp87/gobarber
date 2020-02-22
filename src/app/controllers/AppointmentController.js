import * as Yup from 'yup';
import { startOfHour, parseISO, isBefore, format, subHours } from 'date-fns';
import pt from 'date-fns/locale/pt';
import Appointment from '../models/Appointment';
import User from '../models/User';
import File from '../models/File';
import Notification from '../schemas/Notification';

import Mail from '../../lib/Mail';

class AppointmentController {
  async index(req, res) {
    const { page = 1 } = req.query;

    const appointments = await Appointment.findAll({
      where: { user_id: req.userId, cancelled_at: null },
      order: ['date'],
      attributes: ['id', 'date'],
      limit: 20,
      offset: (page - 1) * 20,
      include: [
        {
          model: User,
          as: 'provider',
          attributes: ['id', 'name'],
          include: [
            {
              model: File,
              as: 'avatar',
              attributes: ['url', 'path']
            }
          ]
        }
      ]
    });

    return res.json(appointments);
  }

  async store(req, res) {
    const schema = Yup.object().shape({
      date: Yup.date().required(),
      provider_id: Yup.number().required()
    });

    if (!(await schema.isValid(req.body))) {
      return res.status(400).json({ error: 'Validation fails' });
    }

    const { provider_id, date } = req.body;

    // Verificar se o agendamento está sendo feito para um prestador
    const isProvider = await User.findOne({
      where: {
        id: provider_id, provider: true }
      });

    if (!isProvider) {
      return res.status(401).json({ error: 'You can only create appointments with providers' });
    }

    // Verificar se o usuário está fazendo um agendamento para ele mesmo
    const isSameUser = await Appointment.findOne({
      where: { provider_id: req.userId }
    });

    if (isSameUser) {
      return res.status(400).json({ error: 'You can not create appointments for yourself' });
    }

    // Verificar se a data de agendamento é uma data passada
    const hourStart = startOfHour(parseISO(date));

    if (isBefore(hourStart, new Date())) {
      return res.status(400).json({ error: 'Past dates are not permitted' });
    }

    // Verifica se a data está disponível para agendamento
    const notAvailable = await Appointment.findOne({
      where: {
        provider_id,
        date: hourStart,
        cancelled_at: null
      }
    });

    if (notAvailable) {
      return res.status(400).json({ error: 'Appointment dote is not available' });
    }

    // Criar a notificação para o prestador de serviço
    const user = await User.findByPk(req.userId);
    const formattedDate = format(
      hourStart,
      "dd 'de' MMMM, 'às' HH:mm'h'",
      { locale: pt }
    );

    await Notification.create({
      content: `Novo agendamento de ${user.name} para dia ${formattedDate}`,
      user: provider_id,
    });

    const appointment = await Appointment.create({
      user_id: req.userId,
      provider_id,
      date: hourStart
    });

    return res.json(appointment);
  }

  async delete(req, res) {
    const appointment = await Appointment.findByPk(req.params.id, {
      include: [
        {
          model: User,
          as: 'provider',
          attributes: ['name', 'email']
        },
        {
          model: User,
          as: 'user',
          attributes: ['name']
        }
      ]
    });

    if (appointment.user_id !== req.userId) {
      return res.status(401).json({ error: "You don't hava permission to cancel this appointment." });
    }

    const dateWithSub = subHours(appointment.date, 2);

    if(isBefore(dateWithSub, new Date())) {
      return res.status(401).json({ error: 'You can only cancel appointments 2 hours in advance.' })
    }

    appointment.cancelled_at = new Date();
    await appointment.save();

    Mail.sendMail({
      to: `${appointment.provider.name} <${appointment.provider.email}>`,
      subject: 'Agendamento cancelado',
      template: 'cancellation',
      context: {
        provider: appointment.provider.name,
        user: appointment.user.name,
        date: format(
          appointment.date,
          "dd 'de' MMMM, 'às' HH:mm'h'",
          { locale: pt }
        )
      }
    })

    return res.json(appointment);
  }
}

export default new AppointmentController();
