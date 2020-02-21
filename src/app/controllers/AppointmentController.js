import * as Yup from 'yup';
import { startOfHour, parseISO, isBefore } from 'date-fns';
import User from '../models/User';
import Appointment from '../models/Appointment';
import { is } from 'date-fns/locale';

class AppointmentController {
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
      return res.status(401).json({error: 'You can only create appointments with providers' });
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

    const appointment = await Appointment.create({
      user_id: req.userId,
      provider_id,
      date: hourStart
    });

    return res.json(appointment);
  }
}

export default new AppointmentController();
